/**
 * Autodesk Construction Cloud (ACC) Integration Module
 * 
 * This module provides the structure for sending documents to ACC
 * via Autodesk Data Management API. The IT team needs to:
 * 
 * 1. Use existing Autodesk Forge App credentials (ADS_CLIENT_ID, ADS_CLIENT_SECRET)
 * 2. Ensure the app has access to the ACC project
 * 3. Provide: ACC_PROJECT_ID, ACC_FOLDER_ID (for the target folder)
 * 
 * Folder structure in ACC:
 * - Project Files/
 *   - Ambiente/
 *     - Fichas de Controlo/
 *       - Semana{XX}_{Year}_{Company}.pdf
 *     - Evidências/
 *       - {MeasureNumber}_{Date}/
 *         - {files}
 */

// Environment variables needed:
// ADS_CLIENT_ID - Already configured (Autodesk Forge App)
// ADS_CLIENT_SECRET - Already configured
// ACC_PROJECT_ID - ACC Project ID (b.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
// ACC_FOLDER_ID - Target folder URN in ACC

interface ACCConfig {
  clientId: string;
  clientSecret: string;
  projectId: string;
  folderId: string;
}

function getConfig(): ACCConfig | null {
  const clientId = process.env.ADS_CLIENT_ID;
  const clientSecret = process.env.ADS_CLIENT_SECRET;
  const projectId = process.env.ACC_PROJECT_ID;
  const folderId = process.env.ACC_FOLDER_ID;
  
  if (!clientId || !clientSecret || !projectId || !folderId) {
    return null;
  }
  return { clientId, clientSecret, projectId, folderId };
}

async function getAccessToken(config: ACCConfig): Promise<string | null> {
  try {
    const response = await fetch("https://developer.api.autodesk.com/authentication/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "client_credentials",
        scope: "data:write data:read",
      }),
    });
    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error("[ACC] Failed to get access token:", error);
    return null;
  }
}

/**
 * Upload a file to ACC (Autodesk Construction Cloud)
 * Uses the Data Management API v2 (two-step: create storage, upload, create version)
 * @param fileName - Name of the file
 * @param fileBuffer - File content as Buffer
 * @param folderId - Optional specific folder (defaults to configured ACC_FOLDER_ID)
 */
export async function uploadToACC(
  fileName: string,
  fileBuffer: Buffer,
  folderId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "ACC not configured. Set ACC_PROJECT_ID and ACC_FOLDER_ID environment variables." };
  }

  const token = await getAccessToken(config);
  if (!token) {
    return { success: false, error: "Failed to authenticate with Autodesk" };
  }

  const targetFolder = folderId || config.folderId;

  try {
    // Step 1: Create storage location
    const storageResponse = await fetch(
      `https://developer.api.autodesk.com/data/v1/projects/${config.projectId}/storage`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/vnd.api+json",
        },
        body: JSON.stringify({
          jsonapi: { version: "1.0" },
          data: {
            type: "objects",
            attributes: { name: fileName },
            relationships: {
              target: { data: { type: "folders", id: targetFolder } },
            },
          },
        }),
      }
    );

    if (!storageResponse.ok) {
      const err = await storageResponse.text();
      return { success: false, error: `ACC storage creation failed: ${err}` };
    }

    const storageData = await storageResponse.json();
    const objectId = storageData.data.id;
    const uploadUrl = storageData.data.relationships?.target?.links?.related?.href;

    if (!uploadUrl) {
      // Use the signed URL approach
      const bucketKey = objectId.split("/")[0].replace("urn:adsk.objects:os.object:", "");
      const objectKey = objectId.split("/")[1];
      const putUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}`;
      
      const uploadResp = await fetch(putUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: fileBuffer as any,
      });

      if (!uploadResp.ok) {
        return { success: false, error: "ACC file upload failed" };
      }
    }

    // Step 2: Create first version (item) in the folder
    const itemResponse = await fetch(
      `https://developer.api.autodesk.com/data/v1/projects/${config.projectId}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/vnd.api+json",
        },
        body: JSON.stringify({
          jsonapi: { version: "1.0" },
          data: {
            type: "items",
            attributes: {
              displayName: fileName,
              extension: { type: "items:autodesk.bim360:File", version: "1.0" },
            },
            relationships: {
              tip: { data: { type: "versions", id: "1" } },
              parent: { data: { type: "folders", id: targetFolder } },
            },
          },
          included: [
            {
              type: "versions",
              id: "1",
              attributes: { name: fileName, extension: { type: "versions:autodesk.bim360:File", version: "1.0" } },
              relationships: { storage: { data: { type: "objects", id: objectId } } },
            },
          ],
        }),
      }
    );

    if (itemResponse.ok) {
      const itemData = await itemResponse.json();
      return { success: true, url: itemData.links?.self?.href };
    } else {
      const err = await itemResponse.text();
      return { success: false, error: `ACC item creation failed: ${err}` };
    }
  } catch (error: any) {
    return { success: false, error: `ACC upload error: ${error.message}` };
  }
}

/**
 * Check if ACC integration is configured
 */
export function isACCConfigured(): boolean {
  return getConfig() !== null;
}

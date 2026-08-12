/**
 * SharePoint Integration Module
 * 
 * This module provides the structure for sending documents to SharePoint
 * via Microsoft Graph API. The IT team needs to:
 * 
 * 1. Register an App in Azure AD (Microsoft Entra)
 * 2. Grant permissions: Sites.ReadWrite.All, Files.ReadWrite.All
 * 3. Provide: SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET, SHAREPOINT_TENANT_ID, SHAREPOINT_SITE_ID
 * 
 * Folder structure in SharePoint:
 * - Ambiente/
 *   - {ProjectCode}/
 *     - Fichas Semanais/
 *       - Semana{XX}_{Year}_{Company}.pdf
 *     - Relatórios/
 *       - RDCD_{ProjectCode}_{Period}.docx
 *     - Planos/
 *       - {PlanName}_{Date}.pdf
 *     - MIRR/
 *       - WasteMap_{ProjectCode}_{Year}.xlsx
 */

// Environment variables needed (to be set by IT team):
// SHAREPOINT_CLIENT_ID - Azure AD App Client ID
// SHAREPOINT_CLIENT_SECRET - Azure AD App Client Secret
// SHAREPOINT_TENANT_ID - Azure AD Tenant ID
// SHAREPOINT_SITE_ID - SharePoint Site ID
// SHAREPOINT_DRIVE_ID - SharePoint Document Library Drive ID

interface SharePointConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  siteId: string;
  driveId: string;
}

function getConfig(): SharePointConfig | null {
  const clientId = process.env.SHAREPOINT_CLIENT_ID;
  const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
  const tenantId = process.env.SHAREPOINT_TENANT_ID;
  const siteId = process.env.SHAREPOINT_SITE_ID;
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  
  if (!clientId || !clientSecret || !tenantId || !siteId || !driveId) {
    return null;
  }
  return { clientId, clientSecret, tenantId, siteId, driveId };
}

async function getAccessToken(config: SharePointConfig): Promise<string | null> {
  try {
    const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });
    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error("[SharePoint] Failed to get access token:", error);
    return null;
  }
}

/**
 * Upload a file to SharePoint
 * @param folderPath - Path within the document library (e.g., "Ambiente/SIN02/Fichas Semanais")
 * @param fileName - Name of the file
 * @param fileBuffer - File content as Buffer
 * @param contentType - MIME type of the file
 */
export async function uploadToSharePoint(
  folderPath: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string = "application/octet-stream"
): Promise<{ success: boolean; url?: string; error?: string }> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: "SharePoint not configured. Set SHAREPOINT_* environment variables." };
  }

  const token = await getAccessToken(config);
  if (!token) {
    return { success: false, error: "Failed to authenticate with SharePoint" };
  }

  try {
    // Create folder path if it doesn't exist
    const encodedPath = encodeURIComponent(`${folderPath}/${fileName}`).replace(/%2F/g, "/");
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${config.siteId}/drives/${config.driveId}/root:/${encodedPath}:/content`;

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: fileBuffer as any,
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, url: data.webUrl };
    } else {
      const error = await response.text();
      return { success: false, error: `SharePoint upload failed: ${response.status} - ${error}` };
    }
  } catch (error: any) {
    return { success: false, error: `SharePoint upload error: ${error.message}` };
  }
}

/**
 * Check if SharePoint integration is configured
 */
export function isSharePointConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Get the folder path for a specific document type
 */
export function getSharePointPath(projectCode: string, docType: "ficha" | "rdcd" | "plano" | "mirr"): string {
  const basePath = "Ambiente";
  switch (docType) {
    case "ficha": return `${basePath}/${projectCode}/Fichas Semanais`;
    case "rdcd": return `${basePath}/${projectCode}/Relatórios`;
    case "plano": return `${basePath}/${projectCode}/Planos`;
    case "mirr": return `${basePath}/${projectCode}/MIRR`;
  }
}

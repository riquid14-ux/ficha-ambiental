# CRITICAL FIXES NEEDED (User is frustrated)

## 1. Dashboard SIN01 - NOT WORKING
- User says dashboard still shows "mesma porcaria" (fichas semanais)
- Need to verify the !isOperationOnly wrapper is actually hiding the content
- The operation card shows but the rest of the page still shows weekly form stuff

## 2. MIRR - Not in Portuguese, no PDF import
- User wants: import PDF (e-GARs come as PDFs), everything in Portuguese
- The LER codes were translated but user says it's still in English
- Need to check what the user actually sees vs what we changed

## 3. Fases Exploração SIN01 - No year-by-year view
- User wants: when in Exploração phase of SIN01, see evidence organized BY YEAR
- e.g., "Evidências 2025", "Evidências 2026" as separate sections
- Each year has its own evidence submissions
- The evidenceYear state was added but the UI doesn't show year tabs/sections

## Key issues:
- Changes may not be deploying correctly
- Need to verify with screenshots what the user actually sees
- The isOperationOnly check may not be working because the project selector context isn't set to SIN01

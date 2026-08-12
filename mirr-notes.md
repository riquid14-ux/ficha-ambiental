# MIRR / WasteMap Structure

## Overview
The MIRR (Mapa Integrado de Registo de Resíduos) tracks waste management for construction projects.
The WasteMap Excel has 4 sheets:

## Sheet 1: Main Page
- Summary dashboard with monthly totals
- Categories: Diverted from landfill, Biodegradable to landfill, Incinerated, Other to landfill
- Monthly waste produced (tonnes)
- Percentage of waste diverted from landfill

## Sheet 2: Egars (e-GARs)
- Input sheet where e-GARs are registered
- Columns: DATA, E GAR ID, Link, Operador, LER CODE, DESIGNATION, QUANTITY (T)
- This is the raw data input - each e-GAR is a waste transport document

## Sheet 3: Waste Recycled
- Waste destination form per month
- For each LER code: Recycled %, Incinerated %, Landfill % (must total 100% per month)
- ~33 LER codes tracked

## Sheet 4: Project
- Monthly waste quantities per LER code (tonnes)
- Same ~33 LER codes
- Monthly totals, Non-hazardous total, Hazardous total, Grand total

## LER Codes tracked (33 codes):
- 20107: Green Waste
- 80111: Paint/varnish waste (hazardous)
- 110111: Aqueous washing liquids (hazardous)
- 130701: Fuel oil and diesel
- 130899: Used oils
- 150101-150111: Packaging (various)
- 150202-150203: Absorbents/filters
- 160103: Used Tyres
- 160216: Toner
- 170101-170904: Construction & demolition waste
- 200108: Biodegradable kitchen waste
- 200101: Paper
- 200301: Municipal solid waste
- 200307: Bulky waste (Monstros)

## What the app needs to do:
1. Import e-GARs (manual entry or file upload)
2. Store by month: LER code, quantity, operator, destination
3. Auto-calculate: monthly totals, recycled/incinerated/landfill splits
4. Track: waste produced, diverted from landfill %, hazardous vs non-hazardous
5. Export: organized Excel with all 4 sheets populated

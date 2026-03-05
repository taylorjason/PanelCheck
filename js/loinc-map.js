/**
 * LOINC code mapping for common lab markers
 * Maps lowercase marker names to LOINC codes and canonical display names
 *
 * Sources: https://loinc.org/
 * This covers the most common panels: CBC, CMP, lipid, thyroid, diabetes, vitamins
 */

const LOINC_MAP = {
    // ── Complete Blood Count (CBC) ──────────────────────────────────────────
    'wbc':                          { code: '6690-2',  display: 'WBC' },
    'white blood cell':             { code: '6690-2',  display: 'WBC' },
    'white blood cell count':       { code: '6690-2',  display: 'WBC' },
    'white blood cells':            { code: '6690-2',  display: 'WBC' },
    'leukocytes':                   { code: '6690-2',  display: 'WBC' },
    'rbc':                          { code: '789-8',   display: 'RBC' },
    'red blood cell':               { code: '789-8',   display: 'RBC' },
    'red blood cell count':         { code: '789-8',   display: 'RBC' },
    'red blood cells':              { code: '789-8',   display: 'RBC' },
    'erythrocytes':                 { code: '789-8',   display: 'RBC' },
    'hemoglobin':                   { code: '718-7',   display: 'Hemoglobin' },
    'hgb':                          { code: '718-7',   display: 'Hemoglobin' },
    'hematocrit':                   { code: '4544-3',  display: 'Hematocrit' },
    'hct':                          { code: '4544-3',  display: 'Hematocrit' },
    'mcv':                          { code: '787-2',   display: 'MCV' },
    'mean corpuscular volume':      { code: '787-2',   display: 'MCV' },
    'mch':                          { code: '785-6',   display: 'MCH' },
    'mean corpuscular hemoglobin':  { code: '785-6',   display: 'MCH' },
    'mchc':                         { code: '786-4',   display: 'MCHC' },
    'platelets':                    { code: '777-3',   display: 'Platelets' },
    'platelet count':               { code: '777-3',   display: 'Platelets' },
    'plt':                          { code: '777-3',   display: 'Platelets' },
    'rdw':                          { code: '788-0',   display: 'RDW' },
    'neutrophils':                  { code: '770-8',   display: 'Neutrophils' },
    'neutrophils %':                { code: '770-8',   display: 'Neutrophils' },
    'lymphocytes':                  { code: '736-9',   display: 'Lymphocytes' },
    'lymphocytes %':                { code: '736-9',   display: 'Lymphocytes' },
    'monocytes':                    { code: '5905-5',  display: 'Monocytes' },
    'monocytes %':                  { code: '5905-5',  display: 'Monocytes' },
    'eosinophils':                  { code: '713-8',   display: 'Eosinophils' },
    'eosinophils %':                { code: '713-8',   display: 'Eosinophils' },
    'basophils':                    { code: '706-2',   display: 'Basophils' },
    'basophils %':                  { code: '706-2',   display: 'Basophils' },

    // ── Comprehensive Metabolic Panel (CMP) ─────────────────────────────────
    'glucose':                      { code: '2345-7',  display: 'Glucose' },
    'blood glucose':                { code: '2345-7',  display: 'Glucose' },
    'fasting glucose':              { code: '1558-6',  display: 'Glucose (fasting)' },
    'bun':                          { code: '3094-0',  display: 'BUN' },
    'blood urea nitrogen':          { code: '3094-0',  display: 'BUN' },
    'urea nitrogen':                { code: '3094-0',  display: 'BUN' },
    'creatinine':                   { code: '2160-0',  display: 'Creatinine' },
    'serum creatinine':             { code: '2160-0',  display: 'Creatinine' },
    'egfr':                         { code: '62238-1', display: 'eGFR' },
    'estimated gfr':                { code: '62238-1', display: 'eGFR' },
    'sodium':                       { code: '2951-2',  display: 'Sodium' },
    'na':                           { code: '2951-2',  display: 'Sodium' },
    'potassium':                    { code: '2823-3',  display: 'Potassium' },
    'k':                            { code: '2823-3',  display: 'Potassium' },
    'chloride':                     { code: '2075-0',  display: 'Chloride' },
    'cl':                           { code: '2075-0',  display: 'Chloride' },
    'co2':                          { code: '2028-9',  display: 'CO2' },
    'carbon dioxide':               { code: '2028-9',  display: 'CO2' },
    'bicarbonate':                  { code: '1963-8',  display: 'Bicarbonate' },
    'calcium':                      { code: '17861-6', display: 'Calcium' },
    'ca':                           { code: '17861-6', display: 'Calcium' },
    'total protein':                { code: '2885-2',  display: 'Total Protein' },
    'protein':                      { code: '2885-2',  display: 'Total Protein' },
    'albumin':                      { code: '1751-7',  display: 'Albumin' },
    'globulin':                     { code: '2336-6',  display: 'Globulin' },
    'a/g ratio':                    { code: '1759-0',  display: 'A/G Ratio' },
    'ag ratio':                     { code: '1759-0',  display: 'A/G Ratio' },
    'bilirubin':                    { code: '1975-2',  display: 'Bilirubin (total)' },
    'total bilirubin':              { code: '1975-2',  display: 'Bilirubin (total)' },
    'direct bilirubin':             { code: '1968-7',  display: 'Bilirubin (direct)' },
    'alt':                          { code: '1742-6',  display: 'ALT' },
    'alanine aminotransferase':     { code: '1742-6',  display: 'ALT' },
    'sgpt':                         { code: '1742-6',  display: 'ALT' },
    'ast':                          { code: '1920-8',  display: 'AST' },
    'aspartate aminotransferase':   { code: '1920-8',  display: 'AST' },
    'sgot':                         { code: '1920-8',  display: 'AST' },
    'alkaline phosphatase':         { code: '6768-6',  display: 'Alkaline Phosphatase' },
    'alk phos':                     { code: '6768-6',  display: 'Alkaline Phosphatase' },
    'alp':                          { code: '6768-6',  display: 'Alkaline Phosphatase' },

    // ── Lipid Panel ──────────────────────────────────────────────────────────
    'total cholesterol':            { code: '2093-3',  display: 'Total Cholesterol' },
    'cholesterol':                  { code: '2093-3',  display: 'Total Cholesterol' },
    'triglycerides':                { code: '2571-8',  display: 'Triglycerides' },
    'trig':                         { code: '2571-8',  display: 'Triglycerides' },
    'hdl':                          { code: '2085-9',  display: 'HDL Cholesterol' },
    'hdl cholesterol':              { code: '2085-9',  display: 'HDL Cholesterol' },
    'hdl-c':                        { code: '2085-9',  display: 'HDL Cholesterol' },
    'ldl':                          { code: '13457-7', display: 'LDL Cholesterol' },
    'ldl cholesterol':              { code: '13457-7', display: 'LDL Cholesterol' },
    'ldl-c':                        { code: '13457-7', display: 'LDL Cholesterol' },
    'vldl':                         { code: '2089-1',  display: 'VLDL Cholesterol' },
    'non-hdl cholesterol':          { code: '43396-1', display: 'Non-HDL Cholesterol' },
    'chol/hdl ratio':               { code: '9830-1',  display: 'Cholesterol/HDL Ratio' },

    // ── Thyroid ──────────────────────────────────────────────────────────────
    'tsh':                          { code: '3016-3',  display: 'TSH' },
    'thyroid stimulating hormone':  { code: '3016-3',  display: 'TSH' },
    'thyrotropin':                  { code: '3016-3',  display: 'TSH' },
    't4':                           { code: '3026-2',  display: 'T4 (total)' },
    'thyroxine':                    { code: '3026-2',  display: 'T4 (total)' },
    'free t4':                      { code: '3024-7',  display: 'Free T4' },
    'ft4':                          { code: '3024-7',  display: 'Free T4' },
    't3':                           { code: '3053-6',  display: 'T3 (total)' },
    'triiodothyronine':             { code: '3053-6',  display: 'T3 (total)' },
    'free t3':                      { code: '3051-0',  display: 'Free T3' },
    'ft3':                          { code: '3051-0',  display: 'Free T3' },

    // ── Diabetes / Glucose Metabolism ────────────────────────────────────────
    'hba1c':                        { code: '4548-4',  display: 'HbA1c' },
    'hemoglobin a1c':               { code: '4548-4',  display: 'HbA1c' },
    'a1c':                          { code: '4548-4',  display: 'HbA1c' },
    'insulin':                      { code: '20448-7', display: 'Insulin' },
    'fasting insulin':              { code: '20448-7', display: 'Insulin (fasting)' },

    // ── Vitamins & Minerals ──────────────────────────────────────────────────
    'vitamin d':                    { code: '35365-6', display: 'Vitamin D (25-OH)' },
    '25-hydroxyvitamin d':          { code: '35365-6', display: 'Vitamin D (25-OH)' },
    '25-oh vitamin d':              { code: '35365-6', display: 'Vitamin D (25-OH)' },
    'vitamin d3':                   { code: '35365-6', display: 'Vitamin D (25-OH)' },
    'vitamin b12':                  { code: '2132-9',  display: 'Vitamin B12' },
    'b12':                          { code: '2132-9',  display: 'Vitamin B12' },
    'cobalamin':                    { code: '2132-9',  display: 'Vitamin B12' },
    'folate':                       { code: '2284-8',  display: 'Folate' },
    'folic acid':                   { code: '2284-8',  display: 'Folate' },
    'iron':                         { code: '2498-4',  display: 'Iron' },
    'serum iron':                   { code: '2498-4',  display: 'Iron' },
    'tibc':                         { code: '2500-7',  display: 'TIBC' },
    'total iron binding capacity':  { code: '2500-7',  display: 'TIBC' },
    'ferritin':                     { code: '2276-4',  display: 'Ferritin' },
    'transferrin saturation':       { code: '2502-3',  display: 'Transferrin Saturation' },
    'magnesium':                    { code: '19123-9', display: 'Magnesium' },
    'mg':                           { code: '19123-9', display: 'Magnesium' },
    'phosphorus':                   { code: '2777-1',  display: 'Phosphorus' },
    'phosphate':                    { code: '2777-1',  display: 'Phosphorus' },
    'zinc':                         { code: '5762-0',  display: 'Zinc' },

    // ── Hormones ─────────────────────────────────────────────────────────────
    'testosterone':                 { code: '2986-8',  display: 'Testosterone (total)' },
    'total testosterone':           { code: '2986-8',  display: 'Testosterone (total)' },
    'free testosterone':            { code: '2990-0',  display: 'Testosterone (free)' },
    'estradiol':                    { code: '2243-4',  display: 'Estradiol' },
    'e2':                           { code: '2243-4',  display: 'Estradiol' },
    'progesterone':                 { code: '2839-9',  display: 'Progesterone' },
    'cortisol':                     { code: '2143-6',  display: 'Cortisol' },
    'dhea-s':                       { code: '2191-5',  display: 'DHEA-S' },
    'dhea sulfate':                 { code: '2191-5',  display: 'DHEA-S' },
    'shbg':                         { code: '13967-5', display: 'SHBG' },
    'sex hormone binding globulin': { code: '13967-5', display: 'SHBG' },
    'lh':                           { code: '10501-5', display: 'LH' },
    'luteinizing hormone':          { code: '10501-5', display: 'LH' },
    'fsh':                          { code: '15067-2', display: 'FSH' },
    'follicle stimulating hormone': { code: '15067-2', display: 'FSH' },
    'prolactin':                    { code: '2842-3',  display: 'Prolactin' },

    // ── Inflammation / Cardiac Risk ───────────────────────────────────────────
    'crp':                          { code: '1988-5',  display: 'CRP' },
    'c-reactive protein':           { code: '1988-5',  display: 'CRP' },
    'hs-crp':                       { code: '30522-7', display: 'hs-CRP' },
    'high sensitivity crp':        { code: '30522-7', display: 'hs-CRP' },
    'esr':                          { code: '30341-2', display: 'ESR' },
    'erythrocyte sedimentation rate': { code: '30341-2', display: 'ESR' },
    'homocysteine':                 { code: '13965-9', display: 'Homocysteine' },
    'uric acid':                    { code: '3084-1',  display: 'Uric Acid' },

    // ── Kidney / Urinalysis ───────────────────────────────────────────────────
    'urine creatinine':             { code: '2161-8',  display: 'Urine Creatinine' },
    'urine protein':                { code: '2888-6',  display: 'Urine Protein' },
    'microalbumin':                 { code: '14585-4', display: 'Microalbumin' },
    'cystatin c':                   { code: '33863-2', display: 'Cystatin C' },
};

/**
 * Look up LOINC code and canonical display name for a marker
 * @param {string} markerName - raw marker name from lab report
 * @returns {{ code: string, display: string }} LOINC entry, or UNK fallback
 */
export function lookupLOINC(markerName) {
    const key = markerName.trim().toLowerCase();
    return LOINC_MAP[key] || { code: 'UNK', display: markerName };
}

/**
 * Vintrace API Connector
 * 
 * Provides bulk wine inventory, batch data, grape contracts, and batch-to-bottle traceability
 * for the Enterprise section of OenoBI dashboard.
 * 
 * Base URLs:
 * - v6: https://us30.vintrace.net/bla/v6/
 * - v7: https://us30.vintrace.net/bla/v7/
 * 
 * Blackbird Vineyards Batch Code Format:
 * BBV-25-CH-###-HUD1
 *   │   │  │   │   └─ Vineyard/Block (4-5 chars)
 *   │   │  │   └───── Sequence in vintage (3 digits)
 *   │   │  └───────── Variety code (e.g., CH=Chardonnay, CS=Cab Sauv)
 *   │   └──────────── Vintage year (2 digits)
 *   └──────────────── Owner prefix (always "BBV" for Blackbird Vineyards)
 */

// Environment variables
const VINTRACE_API_KEY = Deno.env.get("VINTRACE_API_KEY");
// VINTRACE_BASE_URL should be set to "https://us30.vintrace.net/bla" (without trailing slash)
const VINTRACE_BASE_URL = Deno.env.get("VINTRACE_BASE_URL");

if (!VINTRACE_BASE_URL) {
  throw new Error("VINTRACE_BASE_URL environment variable not set. Should be: https://us30.vintrace.net/bla");
}

// Remove trailing slash if present
let baseUrl = VINTRACE_BASE_URL.endsWith('/') ? VINTRACE_BASE_URL.slice(0, -1) : VINTRACE_BASE_URL;

// Ensure /api is NOT in the base url (we'll add it when constructing V6_BASE and V7_BASE)
baseUrl = baseUrl.replace(/\/api.*$/, '');

const V6_BASE = `${baseUrl}/api/v6`;
const V7_BASE = `${baseUrl}/api/v7`;

// Log configuration on module load
console.log(`[Vintrace] Module initialized`);
console.log(`[Vintrace] VINTRACE_BASE_URL from env: ${VINTRACE_BASE_URL}`);
console.log(`[Vintrace] Normalized base URL: ${baseUrl}`);
console.log(`[Vintrace] V6 endpoint base: ${V6_BASE}`);
console.log(`[Vintrace] V7 endpoint base: ${V7_BASE}`);
console.log(`[Vintrace] API Key configured: ${VINTRACE_API_KEY ? 'YES (***' + VINTRACE_API_KEY.slice(-4) + ')' : 'NO'}`);

/**
 * Supported search types for Vintrace v6/search/list endpoint
 */
export type VintraceSearchType =
  | "grading"
  | "owner"
  | "program"
  | "varietal"
  | "vintage"
  | "productState"
  | "region"
  | "block"
  | "grower"
  | "productCategory"
  | "batch"
  | "product"
  | "tank"
  | "vessel"
  | "containerEquipment"
  | "barrel"
  | "bin";

/**
 * Search parameters for Vintrace search endpoint
 */
export interface VintraceSearchParams {
  type: VintraceSearchType;
  exactMatch?: boolean;
  first?: number;
  startsWith?: string;
}

/**
 * Parsed Blackbird batch code
 * Example: "BBV-25-CH-001-HUD1"
 */
export interface BlackbirdBatchCode {
  raw: string;
  owner: string;        // "BBV"
  vintage: number;      // 25 (2025)
  vintageYear: number;  // 2025
  variety: string;      // "CH"
  sequence: number;     // 1
  vineyard: string;     // "HUD1"
  isValid: boolean;
}

/**
 * Parse a Blackbird batch code into structured data
 * 
 * Format: BBV-25-CH-001-HUD1
 * 
 * @param code - Raw batch code string
 * @returns Parsed batch code object
 */
export function parseBlackbirdBatchCode(code: string): BlackbirdBatchCode {
  const parts = code.split("-");
  
  if (parts.length < 5 || parts[0] !== "BBV") {
    return {
      raw: code,
      owner: parts[0] || "",
      vintage: 0,
      vintageYear: 0,
      variety: "",
      sequence: 0,
      vineyard: "",
      isValid: false,
    };
  }

  const vintage = parseInt(parts[1], 10);
  const vintageYear = vintage < 50 ? 2000 + vintage : 1900 + vintage;
  const sequence = parseInt(parts[3], 10);

  return {
    raw: code,
    owner: parts[0],
    vintage,
    vintageYear,
    variety: parts[2],
    sequence,
    vineyard: parts.slice(4).join("-"), // Handle multi-part vineyard names
    isValid: true,
  };
}

/**
 * Make authenticated request to Vintrace API
 * 
 * @param endpoint - Full endpoint URL
 * @param params - Query parameters
 * @returns JSON response
 */
async function vintraceRequest<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
  if (!VINTRACE_API_KEY) {
    throw new Error("VINTRACE_API_KEY environment variable not set");
  }

  // Build query string from params
  const queryString = params 
    ? "?" + new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : "";

  const url = `${endpoint}${queryString}`;
  
  console.log(`[Vintrace] Request params:`, JSON.stringify(params, null, 2));
  console.log(`[Vintrace] Query string:`, queryString);
  console.log(`[Vintrace] Full URL:`, url);
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${VINTRACE_API_KEY}`,
      "correlation-id": "", // Required by Vintrace API
    },
  });

  console.log(`[Vintrace] GET ${url}`);
  console.log(`[Vintrace] Using API Key: ${VINTRACE_API_KEY ? '***' + VINTRACE_API_KEY.slice(-4) : 'NOT SET'}`);

  const contentType = response.headers.get("content-type") || "";
  console.log(`[Vintrace] Response status: ${response.status}, Content-Type: ${contentType}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Vintrace] Error ${response.status}: ${errorText.substring(0, 500)}`);
    throw new Error(`Vintrace API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const responseText = await response.text();
  console.log(`[Vintrace] Raw response (first 300 chars): ${responseText.substring(0, 300)}`);
  
  // Check if response is HTML instead of JSON
  if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
    console.error(`[Vintrace] Received HTML instead of JSON. Full response (first 1000 chars): ${responseText.substring(0, 1000)}`);
    throw new Error(`Vintrace API returned HTML instead of JSON. This usually means the URL is incorrect or authentication failed. URL: ${url}`);
  }
  
  // Try to parse JSON
  try {
    const data = JSON.parse(responseText);
    console.log(`[Vintrace] Parsed JSON successfully. Type: ${Array.isArray(data) ? 'Array' : typeof data}`);
    return data;
  } catch (parseError) {
    console.error(`[Vintrace] JSON parse error:`, parseError);
    console.error(`[Vintrace] Failed to parse response:`, responseText.substring(0, 500));
    throw new Error(`Failed to parse Vintrace API response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
}

/**
 * Search Vintrace database by type
 * 
 * v6 endpoint: /search/list
 * 
 * @param params - Search parameters
 * @returns Search results
 */
export async function searchVintrace(params: VintraceSearchParams): Promise<any[]> {
  const endpoint = `${V6_BASE}/search/list`;
  
  const queryParams: Record<string, any> = {
    type: params.type,
  };

  if (params.exactMatch !== undefined) {
    queryParams.exactMatch = params.exactMatch;
  }

  if (params.first !== undefined) {
    queryParams.first = params.first;
  }

  if (params.startsWith !== undefined) {
    queryParams.startsWith = params.startsWith;
  }

  const response = await vintraceRequest<any>(endpoint, queryParams);
  
  // Vintrace returns an object with simpleSearchResults array
  // Format: { simpleSearchResults: [...], firstResult: 0, maxResult: 100, totalResultCount: 11 }
  if (response && typeof response === 'object' && Array.isArray(response.simpleSearchResults)) {
    console.log(`[Vintrace] Found ${response.simpleSearchResults.length} results (total: ${response.totalResultCount})`);
    return response.simpleSearchResults;
  }
  
  // Fallback: if response is already an array, return it
  if (Array.isArray(response)) {
    return response;
  }
  
  console.warn(`[Vintrace] Unexpected response format:`, typeof response);
  return [];
}

/**
 * Get all Blackbird batches (startsWith "BBV")
 * 
 * @returns Array of batch objects
 */
export async function getBlackbirdBatches(): Promise<any[]> {
  console.log("[Vintrace] Fetching all Blackbird batches (BBV prefix)...");
  
  const batches = await searchVintrace({
    type: "batch",
    startsWith: "BBV",
    exactMatch: false,
  });

  console.log(`[Vintrace] Found ${batches.length} Blackbird batches`);
  return batches;
}

/**
 * Get all varietals
 * 
 * @returns Array of varietal objects
 */
export async function getVarietals(): Promise<any[]> {
  console.log("[Vintrace] Fetching varietals...");
  
  const varietals = await searchVintrace({
    type: "varietal",
  });

  console.log(`[Vintrace] Found ${varietals.length} varietals`);
  return varietals;
}

/**
 * Get all vintages
 * 
 * @returns Array of vintage objects
 */
export async function getVintages(): Promise<any[]> {
  console.log("[Vintrace] Fetching vintages...");
  
  const vintages = await searchVintrace({
    type: "vintage",
  });

  console.log(`[Vintrace] Found ${vintages.length} vintages`);
  return vintages;
}

/**
 * Get all owners
 * 
 * @returns Array of owner objects
 */
export async function getOwners(): Promise<any[]> {
  console.log("[Vintrace] Fetching owners...");
  
  const owners = await searchVintrace({
    type: "owner",
  });

  console.log(`[Vintrace] Found ${owners.length} owners`);
  return owners;
}

/**
 * Get all tanks/vessels
 * 
 * @returns Array of tank/vessel objects
 */
export async function getTanks(): Promise<any[]> {
  console.log("[Vintrace] Fetching tanks...");
  
  const tanks = await searchVintrace({
    type: "tank",
  });

  console.log(`[Vintrace] Found ${tanks.length} tanks`);
  return tanks;
}

/**
 * Get inventory from v6/inventory endpoint
 * 
 * @param ownerId - Optional owner ID to filter by
 * @returns Array of inventory items
 */
export async function getInventory(ownerId?: number): Promise<any[]> {
  console.log(`[Vintrace] Fetching inventory${ownerId ? ` for owner ID ${ownerId}` : ''}...`);
  
  const endpoint = `${V6_BASE}/inventory`;
  const params = ownerId ? { ownerId } : undefined;
  const inventory = await vintraceRequest<any[]>(endpoint, params);

  console.log(`[Vintrace] Found ${Array.isArray(inventory) ? inventory.length : 0} inventory items`);
  return Array.isArray(inventory) ? inventory : [];
}

/**
 * Get Blackbird inventory (items with SKU/name starting with "BBV")
 * 
 * @returns Array of BBV inventory items
 */
export async function getBlackbirdInventory(): Promise<any[]> {
  console.log("[Vintrace] Fetching Blackbird inventory (owner ID 1)...");
  
  // Use owner ID 1 for "Blackbird Vineyards"
  const inventory = await getInventory(1);

  console.log(`[Vintrace] Found ${inventory.length} Blackbird inventory items`);
  return inventory;
}

/**
 * Get wine batches from v7/operation/wine-batches endpoint
 * 
 * @param ownerId - Optional owner ID to filter by
 * @param offset - Pagination offset (default: 0)
 * @param limit - Results per page (default: 100)
 * @returns Paginated wine batches response
 */
export async function getWineBatches(ownerId?: number, offset = 0, limit = 100): Promise<any> {
  console.log(`[Vintrace] Fetching wine batches${ownerId ? ` for owner ID ${ownerId}` : ''} (offset: ${offset}, limit: ${limit})...`);
  
  const endpoint = `${V7_BASE}/operation/wine-batches`;
  const params: Record<string, any> = { offset, limit };
  
  if (ownerId) {
    params.ownerId = ownerId;
  }
  
  const response = await vintraceRequest<any>(endpoint, params);

  console.log(`[Vintrace] Found ${response.totalResults || 0} total wine batches, returned ${response.results?.length || 0} in this page`);
  return response;
}

/**
 * Get all Blackbird wine batches (owner ID 3)
 * Fetches all pages automatically
 * 
 * @param productionYears - Optional array of production years to filter by
 * @returns Array of all Blackbird wine batches
 */
export async function getBlackbirdWineBatches(productionYears?: number[]): Promise<any[]> {
  console.log(`[Vintrace] Fetching all Blackbird wine batches (owner ID 3)${productionYears ? ` for years ${productionYears.join(', ')}` : ''}...`);
  
  let allBatches: any[] = [];
  let offset = 0;
  const limit = 100;
  let totalResults = 0;
  
  do {
    const response = await getWineBatches(3, offset, limit);
    
    if (!response.results || !Array.isArray(response.results)) {
      console.warn(`[Vintrace] Unexpected response format at offset ${offset}`);
      break;
    }
    
    allBatches = allBatches.concat(response.results);
    totalResults = response.totalResults || 0;
    offset += limit;
    
    console.log(`[Vintrace] Progress: ${allBatches.length}/${totalResults} batches fetched`);
    
    // Stop if we've fetched all results
    if (allBatches.length >= totalResults) {
      break;
    }
    
    // Safety check to prevent infinite loop
    if (offset > 10000) {
      console.warn(`[Vintrace] Safety limit reached at offset ${offset}`);
      break;
    }
  } while (allBatches.length < totalResults);

  // Filter by production years if specified
  if (productionYears && productionYears.length > 0) {
    const beforeFilter = allBatches.length;
    allBatches = allBatches.filter((batch: any) => 
      productionYears.includes(batch.productionYear)
    );
    console.log(`[Vintrace] Filtered from ${beforeFilter} to ${allBatches.length} batches for years ${productionYears.join(', ')}`);
  }

  console.log(`[Vintrace] Finished fetching ${allBatches.length} Blackbird wine batches`);
  return allBatches;
}

/**
 * Get vessel contents/volume for a specific batch
 * v7 endpoint: /operation/batch/{batchId}/vessel-contents
 * 
 * @param batchId - Batch ID
 * @returns Vessel contents with volume information
 */
export async function getBatchVesselContents(batchId: number): Promise<any[]> {
  console.log(`[Vintrace] Fetching vessel contents for batch ID ${batchId}...`);
  
  const endpoint = `${V7_BASE}/operation/batch/${batchId}/vessel-contents`;
  const contents = await vintraceRequest<any>(endpoint);

  console.log(`[Vintrace] Found vessel contents for batch ${batchId}:`, JSON.stringify(contents).substring(0, 200));
  return Array.isArray(contents) ? contents : (contents ? [contents] : []);
}

/**
 * Get vessel details report from v7/report/vessel-details-report endpoint
 * Returns vessels with volume information and associated wine batch data
 * 
 * @param ownerId - Optional owner ID to filter by
 * @param offset - Pagination offset (default: 0)
 * @param limit - Results per page (default: 100)
 * @returns Paginated vessel details response
 */
export async function getVesselDetailsReport(ownerId?: number, offset = 0, limit = 100): Promise<any> {
  console.log(`[Vintrace] Fetching vessel details report${ownerId ? ` for owner ID ${ownerId}` : ''} (offset: ${offset}, limit: ${limit})...`);
  
  const endpoint = `${V7_BASE}/report/vessel-details-report`;
  const params: Record<string, any> = { 
    offset, 
    limit,
    // Include extra fields for composition, allocations, and live metrics
    extraFields: 'allocations,composition,livemetrics'
  };
  
  if (ownerId) {
    // Owner parameter should be a string
    params.owner = String(ownerId);
  }
  
  const response = await vintraceRequest<any>(endpoint, params);

  console.log(`[Vintrace] Found ${response.totalResults || 0} total vessels, returned ${response.results?.length || 0} in this page`);
  return response;
}

/**
 * Get all vessel details for Blackbird (owner ID 3)
 * Fetches all pages automatically
 * 
 * @returns Array of all vessel details
 */
export async function getAllBlackbirdVesselDetails(): Promise<any[]> {
  console.log(`[Vintrace] Fetching all Blackbird vessel details (owner ID 3)...`);
  
  let allVessels: any[] = [];
  let offset = 0;
  const limit = 100;
  let totalResults = 0;
  
  do {
    const response = await getVesselDetailsReport(3, offset, limit);
    
    if (!response.results || !Array.isArray(response.results)) {
      console.warn(`[Vintrace] Unexpected response format at offset ${offset}`);
      break;
    }
    
    allVessels = allVessels.concat(response.results);
    totalResults = response.totalResults || 0;
    offset += limit;
    
    console.log(`[Vintrace] Progress: ${allVessels.length}/${totalResults} vessels fetched`);
    
    // Stop if we've fetched all results
    if (allVessels.length >= totalResults) {
      break;
    }
    
    // Safety check to prevent infinite loop
    if (offset > 10000) {
      console.warn(`[Vintrace] Safety limit reached at offset ${offset}`);
      break;
    }
  } while (allVessels.length < totalResults);

  console.log(`[Vintrace] Finished fetching ${allVessels.length} Blackbird vessel details`);
  return allVessels;
}

/**
 * Get stock dispatches from v7/stock/dispatches endpoint
 * Returns dispatches with type information (e.g., bottling, transfers)
 * 
 * @param ownerId - Optional owner ID to filter by
 * @param offset - Pagination offset (default: 0)
 * @param limit - Results per page (default: 100)
 * @param startDate - Optional start date (ISO format YYYY-MM-DD)
 * @param endDate - Optional end date (ISO format YYYY-MM-DD)
 * @returns Paginated stock dispatches response
 */
export async function getStockDispatches(
  ownerId?: number, 
  offset = 0, 
  limit = 100,
  startDate?: string,
  endDate?: string
): Promise<any> {
  console.log(`[Vintrace] Fetching stock dispatches${ownerId ? ` for owner ID ${ownerId}` : ''} (offset: ${offset}, limit: ${limit})...`);
  
  const endpoint = `${V7_BASE}/stock/dispatches`;
  const params: Record<string, any> = { offset, limit };
  
  // Try without owner filter first to see if endpoint exists
  // if (ownerId) {
  //   // Owner parameter should be a string for v7 endpoints
  //   params.owner = String(ownerId);
  // }
  
  if (startDate) {
    params.startDate = startDate;
  }
  
  if (endDate) {
    params.endDate = endDate;
  }
  
  console.log(`[Vintrace] Calling endpoint: ${endpoint}`);
  console.log(`[Vintrace] With params:`, params);
  
  const response = await vintraceRequest<any>(endpoint, params);

  console.log(`[Vintrace] Found ${response.totalResults || 0} total dispatches, returned ${response.results?.length || 0} in this page`);
  return response;
}

/**
 * Get all stock dispatches for Blackbird (owner ID 3)
 * Fetches all pages automatically
 * 
 * @param startDate - Optional start date (ISO format YYYY-MM-DD)
 * @param endDate - Optional end date (ISO format YYYY-MM-DD)
 * @returns Array of all stock dispatches
 */
export async function getAllBlackbirdDispatches(startDate?: string, endDate?: string): Promise<any[]> {
  console.log(`[Vintrace] Fetching all Blackbird stock dispatches (owner ID 3)${startDate ? ` from ${startDate}` : ''}${endDate ? ` to ${endDate}` : ''}...`);
  
  let allDispatches: any[] = [];
  let offset = 0;
  const limit = 100;
  let totalResults = 0;
  
  do {
    const response = await getStockDispatches(3, offset, limit, startDate, endDate);
    
    if (!response.results || !Array.isArray(response.results)) {
      console.warn(`[Vintrace] Unexpected response format at offset ${offset}`);
      break;
    }
    
    allDispatches = allDispatches.concat(response.results);
    totalResults = response.totalResults || 0;
    offset += limit;
    
    console.log(`[Vintrace] Progress: ${allDispatches.length}/${totalResults} dispatches fetched`);
    
    // Stop if we've fetched all results
    if (allDispatches.length >= totalResults) {
      break;
    }
    
    // Safety check to prevent infinite loop
    if (offset > 10000) {
      console.warn(`[Vintrace] Safety limit reached at offset ${offset}`);
      break;
    }
  } while (allDispatches.length < totalResults);

  console.log(`[Vintrace] Finished fetching ${allDispatches.length} Blackbird stock dispatches`);
  return allDispatches;
}

/**
 * Get costs from v7/costs endpoint
 * Returns cost movements with costDelta breakdown (fruit, overhead, etc.)
 * 
 * @param ownerId - Optional owner ID to filter by
 * @param offset - Pagination offset (default: 0)
 * @param limit - Results per page (default: 100)
 * @returns Paginated costs response
 */
export async function getCosts(
  ownerId?: number,
  offset = 0,
  limit = 100
): Promise<any> {
  console.log(`[Vintrace] Fetching costs${ownerId ? ` for owner ID ${ownerId}` : ''} (offset: ${offset}, limit: ${limit})...`);
  
  // Try different endpoint paths - the costs endpoint might be at a different location
  const possibleEndpoints = [
    `${V7_BASE}/costs`,
    `${V7_BASE}/operation/costs`,
    `${V7_BASE}/cost`,
    `${V6_BASE}/costs`,
  ];
  
  let lastError: Error | null = null;
  
  for (const endpoint of possibleEndpoints) {
    try {
      const params: Record<string, any> = { offset, limit };
      
      // Don't filter by owner on first attempt to see if endpoint exists
      // if (ownerId) {
      //   params.owner = String(ownerId);
      // }
      
      console.log(`[Vintrace] Trying endpoint: ${endpoint}`);
      const response = await vintraceRequest<any>(endpoint, params);
      
      console.log(`[Vintrace] ✓ Success! Found ${response.totalResults || 0} total costs at ${endpoint}`);
      return response;
    } catch (error) {
      console.log(`[Vintrace] ✗ Failed at ${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  
  throw lastError || new Error('All costs endpoints failed');
}

/**
 * Get all costs for Blackbird (owner ID 3)
 * Fetches all pages automatically
 * 
 * @returns Array of all cost records
 */
export async function getAllBlackbirdCosts(): Promise<any[]> {
  console.log(`[Vintrace] Fetching all Blackbird costs (owner ID 3)...`);
  
  let allCosts: any[] = [];
  let offset = 0;
  const limit = 100;
  let totalResults = 0;
  
  do {
    const response = await getCosts(3, offset, limit);
    
    if (!response.results || !Array.isArray(response.results)) {
      console.warn(`[Vintrace] Unexpected response format at offset ${offset}`);
      break;
    }
    
    allCosts = allCosts.concat(response.results);
    totalResults = response.totalResults || 0;
    offset += limit;
    
    console.log(`[Vintrace] Progress: ${allCosts.length}/${totalResults} costs fetched`);
    
    // Stop if we've fetched all results
    if (allCosts.length >= totalResults) {
      break;
    }
    
    // Safety check to prevent infinite loop
    if (offset > 10000) {
      console.warn(`[Vintrace] Safety limit reached at offset ${offset}`);
      break;
    }
  } while (allCosts.length < totalResults);

  console.log(`[Vintrace] Finished fetching ${allCosts.length} Blackbird cost records`);
  return allCosts;
}

/**
 * Export for testing/debugging
 */
export const VintraceAPI = {
  search: searchVintrace,
  getBlackbirdBatches,
  getVarietals,
  getVintages,
  getOwners,
  getTanks,
  getInventory,
  getBlackbirdInventory,
  getWineBatches,
  getBlackbirdWineBatches,
  getBatchVesselContents,
  getAllBlackbirdVesselDetails,
  getStockDispatches,
  getAllBlackbirdDispatches,
  getCosts,
  getAllBlackbirdCosts,
  parseBlackbirdBatchCode,
  
  // Constants for debugging
  getV6Base: () => V6_BASE,
  getV7Base: () => V7_BASE,
};
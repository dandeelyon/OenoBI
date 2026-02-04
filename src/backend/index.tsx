import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { VintraceAPI, type VintraceSearchType } from "./vintrace.tsx";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const app = new Hono();
/* =======================
   CORS – MUST BE FIRST
   ======================= */
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Retry-After"],
    maxAge: 600,
  }),
);

app.options("/*", (c) => c.text("", 204));

// Enable logger
app.use('*', logger(console.log));

// Commerce 7 API Configuration
const COMMERCE7_API_KEY = Deno.env.get("COMMERCE7_API_KEY");
const COMMERCE7_TENANT_ID = Deno.env.get("COMMERCE7_TENANT_ID");
const COMMERCE7_BASE_URL = "https://api.commerce7.com/v1";

// Vintrace API Configuration
const VINTRACE_API_KEY = Deno.env.get("VINTRACE_API_KEY");
const VINTRACE_BASE_URL = Deno.env.get("VINTRACE_BASE_URL") || "https://us30.vintrace.net/bla/api/v6"; // Tenant-specific URL

// Helper for sleep
async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// Cache with TTL tracking
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let ordersCache: CacheEntry<any[]> | null = null;
let productsCache: CacheEntry<any[]> | null = null;
let customersCache: CacheEntry<any[]> | null = null;

// Separate TTLs: orders change frequently, products don't
const ORDERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PRODUCTS_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const CUSTOMERS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Helper to check if cache is valid
function isOrdersCacheValid(force = false): boolean {
  return !force && ordersCache !== null && (Date.now() - ordersCache.timestamp < ORDERS_CACHE_TTL_MS);
}

function isProductsCacheValid(force = false): boolean {
  return !force && productsCache !== null && (Date.now() - productsCache.timestamp < PRODUCTS_CACHE_TTL_MS);
}

function isCustomersCacheValid(force = false): boolean {
  return !force && customersCache !== null && (Date.now() - customersCache.timestamp < CUSTOMERS_CACHE_TTL_MS);
}

// Commerce7 request helper
async function commerce7Request(path: string, opts: RequestInit = {}, attempt = 0): Promise<any> {
  if (!COMMERCE7_API_KEY || !COMMERCE7_TENANT_ID) {
    throw new Error("Commerce 7 API credentials not configured");
  }

  // Defensively cap any limit parameter to 50 max (Commerce7 requirement)
  let finalPath = path;
  const limitMatch = path.match(/[?&]limit=(\d+)/);
  if (limitMatch) {
    const requestedLimit = parseInt(limitMatch[1]);
    if (requestedLimit > 50) {
      console.warn(`[Commerce7] Capping limit from ${requestedLimit} to 50`);
      finalPath = path.replace(/([?&])limit=\d+/, `$1limit=50`);
    }
  }

  const url = `${COMMERCE7_BASE_URL}${finalPath}`;
  
  // Commerce7 uses HTTP Basic Auth: username="dash" (appId), password=API_KEY
  const basicAuthCredentials = btoa(`dash:${COMMERCE7_API_KEY}`);
  const headers = {
    "Authorization": `Basic ${basicAuthCredentials}`,
    "tenant": COMMERCE7_TENANT_ID,
    "Accept": "application/json",
    "Content-Type": "application/json",
    ...opts.headers,
  };

  const response = await fetch(url, { ...opts, headers });

  // Handle rate limiting with backoff + Retry-After
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    const retryMs =
      retryAfter ? Math.max(250, parseInt(retryAfter, 10) * 1000)
                 : Math.min(10_000, 500 * Math.pow(2, attempt)); // exponential backoff

    console.warn(`[Commerce7] 429 rate limit. Backing off ${retryMs}ms (attempt ${attempt + 1})`);
    await sleep(retryMs);

    if (attempt < 6) return commerce7Request(path, opts, attempt + 1);

    const errorText = await response.text();
    throw new Error(`Commerce 7 rate limit persisted after retries: ${errorText}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Commerce 7 API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

// Health check endpoint
app.get("/backend-api/health", (c) => {
  return c.json({ status: "ok" });
});

// Debug endpoint to verify Commerce 7 credentials are configured
// SECURITY: Only returns credential existence, not values
app.get("/backend-api/commerce7/debug", (c) => {
  return c.json({
    hasApiKey: !!COMMERCE7_API_KEY,
    hasTenantId: !!COMMERCE7_TENANT_ID,
  })
});

// Test endpoint to try different header combinations
app.get("/backend-api/commerce7/test-auth", async (c) => {
  const testResults = [];
  const testUrl = `${COMMERCE7_BASE_URL}/order?limit=1`;
  
  // Test 1: lowercase headers
  try {
    const response = await fetch(testUrl, {
      headers: {
        "token": COMMERCE7_API_KEY,
        "tenant": COMMERCE7_TENANT_ID,
        "appid": "dash",
      }
    });
    testResults.push({
      test: "Lowercase (token, tenant, appid)",
      status: response.status,
      success: response.ok,
      body: response.ok ? "Success!" : await response.text()
    });
  } catch (error) {
    testResults.push({ test: "Lowercase", error: error.message });
  }

  // Test 2: camelCase headers
  try {
    const response = await fetch(testUrl, {
      headers: {
        "token": COMMERCE7_API_KEY,
        "tenant": COMMERCE7_TENANT_ID,
        "appId": "dash",
      }
    });
    testResults.push({
      test: "camelCase (token, tenant, appId)",
      status: response.status,
      success: response.ok,
      body: response.ok ? "Success!" : await response.text()
    });
  } catch (error) {
    testResults.push({ test: "camelCase", error: error.message });
  }

  // Test 3: PascalCase headers
  try {
    const response = await fetch(testUrl, {
      headers: {
        "Token": COMMERCE7_API_KEY,
        "Tenant": COMMERCE7_TENANT_ID,
        "AppId": "dash",
      }
    });
    testResults.push({
      test: "PascalCase (Token, Tenant, AppId)",
      status: response.status,
      success: response.ok,
      body: response.ok ? "Success!" : await response.text()
    });
  } catch (error) {
    testResults.push({ test: "PascalCase", error: error.message });
  }

  // Test 4: Authorization Bearer
  try {
    const response = await fetch(testUrl, {
      headers: {
        "Authorization": `Bearer ${COMMERCE7_API_KEY}`,
        "tenant": COMMERCE7_TENANT_ID,
        "appId": "dash",
      }
    });
    testResults.push({
      test: "Authorization Bearer",
      status: response.status,
      success: response.ok,
      body: response.ok ? "Success!" : await response.text()
    });
  } catch (error) {
    testResults.push({ test: "Authorization Bearer", error: error.message });
  }

  // Test 5: X- prefixed headers
  try {
    const response = await fetch(testUrl, {
      headers: {
        "x-api-token": COMMERCE7_API_KEY,
        "x-tenant-id": COMMERCE7_TENANT_ID,
        "x-app-id": "dash",
      }
    });
    testResults.push({
      test: "X- prefixed (x-api-token, x-tenant-id, x-app-id)",
      status: response.status,
      success: response.ok,
      body: response.ok ? "Success!" : await response.text()
    });
  } catch (error) {
    testResults.push({ test: "X- prefixed", error: error.message });
  }

  // Test 6: api-key variant
  try {
    const response = await fetch(testUrl, {
      headers: {
        "api-key": COMMERCE7_API_KEY,
        "tenant": COMMERCE7_TENANT_ID,
        "appId": "dash",
      }
    });
    testResults.push({
      test: "api-key header",
      status: response.status,
      success: response.ok,
      body: response.ok ? "Success!" : await response.text()
    });
  } catch (error) {
    testResults.push({ test: "api-key", error: error.message });
  }

  return c.json({
    message: "Tested multiple authentication patterns",
    results: testResults,
    successfulTests: testResults.filter(r => r.success)
  });
});

// Get orders with date filtering (server-side date filter since API doesn't support it)
app.get("/backend-api/commerce7/orders", async (c) => {
  try {
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    console.log(`[Commerce7] Fetching orders with date range: ${startDate} to ${endDate}`);

    // Check cache
    if (isOrdersCacheValid()) {
      console.log('[Commerce7] Using cached orders data');
      const allOrders = ordersCache.data;
      
      // Filter orders by date if provided
      let filteredOrders = allOrders;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        filteredOrders = allOrders.filter(order => {
          const orderDate = new Date(order.orderDate);
          return orderDate >= start && orderDate <= end;
        });
        
        console.log(`[Commerce7] Filtered to ${filteredOrders.length} orders within date range`);
      }

      return c.json({ orders: filteredOrders });
    }

    // Commerce 7 doesn't support date filtering in query params
    // Fetch recent orders with pagination and filter by date in code
    const allOrders = [];
    let page = 1;
    
    while (true) {
      const data = await commerce7Request(`/order?page=${page}&limit=50`);
      const orders = data.orders || [];
      if (orders.length === 0) break;

      allOrders.push(...orders);
      page++;
      
      // Global queue handles rate limiting automatically
      
      // Safety limit: stop after 150 pages (~7500 orders)
      if (page > 150) {
        console.log('[Commerce7] Reached pagination safety limit (150 pages)');
        break;
      }
    }

    console.log(`[Commerce7] Fetched ${allOrders.length} total orders`);

    // Cache the orders data
    ordersCache = { data: allOrders, timestamp: Date.now() };

    // Filter orders by date if provided
    let filteredOrders = allOrders;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= start && orderDate <= end;
      });
      
      console.log(`[Commerce7] Filtered to ${filteredOrders.length} orders within date range`);
    }

    return c.json({ orders: filteredOrders });
  } catch (error) {
    console.error("[Commerce7] Error fetching orders:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      orders: [] 
    }, 500);
  }
});

// Get sales metrics
app.get("/backend-api/commerce7/sales-metrics", async (c) => {
  try {
    const { startDate, endDate } = c.req.query();
    
    console.log(`[Commerce7] Fetching sales metrics with date range: ${startDate} to ${endDate}`);

    // Check cache
    if (isOrdersCacheValid()) {
      console.log('[Commerce7] Using cached orders data for metrics');
      const allOrders = ordersCache.data;
      
      // Filter by date range if provided
      let orders = allOrders;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        orders = allOrders.filter((order: any) => {
          const orderDate = new Date(order.createdAt || order.orderDate || order.purchasedAt);
          if (start && orderDate < start) return false;
          if (end && orderDate > end) return false;
          return true;
        });
        
        console.log(`[Commerce7] Filtered to ${orders.length} orders for metrics within date range`);
      }

      // Calculate metrics from orders
      const totalRevenue = orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);
      const orderCount = orders.length;
      const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
      
      // Get unique customers
      const uniqueCustomers = new Set(orders.map((order: any) => order.customerId).filter(Boolean));
      const newCustomers = uniqueCustomers.size;

      return c.json({
        totalRevenue,
        orderCount,
        averageOrderValue,
        newCustomers,
        orders: orders.slice(0, 10), // Return first 10 orders for detail
      });
    }

    // Commerce 7 doesn't support date filtering in query params
    // Fetch all orders with pagination
    const allOrders = [];
    let page = 1;
    
    while (true) {
      const endpoint = `/order?page=${page}&limit=50`;
      console.log(`[Commerce7] Fetching orders page ${page} for metrics`);
      
      const data = await commerce7Request(endpoint);
      const orders = data.orders || [];
      
      if (orders.length === 0) {
        console.log(`[Commerce7] All order pages fetched. Total pages: ${page - 1}`);
        break;
      }
      
      allOrders.push(...orders);
      page++;
      
      // Global queue handles rate limiting automatically
      
      // Safety limit: stop after 150 pages (~7500 orders)
      if (page > 150) {
        console.log('[Commerce7] Reached pagination safety limit (150 pages)');
        break;
      }
    }

    console.log(`[Commerce7] Fetched ${allOrders.length} total orders for metrics`);

    // Cache the orders data
    ordersCache = { data: allOrders, timestamp: Date.now() };

    // Filter by date range if provided
    let orders = allOrders;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      orders = allOrders.filter((order: any) => {
        const orderDate = new Date(order.createdAt || order.orderDate || order.purchasedAt);
        if (start && orderDate < start) return false;
        if (end && orderDate > end) return false;
        return true;
      });
      
      console.log(`[Commerce7] Filtered to ${orders.length} orders for metrics within date range`);
    }

    // Calculate metrics from orders
    const totalRevenue = orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);
    const orderCount = orders.length;
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
    
    // Get unique customers
    const uniqueCustomers = new Set(orders.map((order: any) => order.customerId).filter(Boolean));
    const newCustomers = uniqueCustomers.size;

    return c.json({
      totalRevenue,
      orderCount,
      averageOrderValue,
      newCustomers,
      orders: orders.slice(0, 10), // Return first 10 orders for detail
    });
  } catch (error) {
    console.error("Error calculating sales metrics:", error);
    return c.json({ 
      error: "Failed to calculate sales metrics",
      message: error.message 
    }, 500);
  }
});

// Get customer data
app.get("/backend-api/commerce7/customers", async (c) => {
  try {
    const requestedLimit = parseInt(c.req.query("limit") || "50");
    const limit = Math.min(requestedLimit, 50); // Commerce7 API requires limit <= 50
    
    const endpoint = `/customer?limit=${limit}`;
    const data = await commerce7Request(endpoint);
    return c.json(data);
  } catch (error) {
    console.error("Error fetching Commerce 7 customers:", error);
    return c.json({ 
      error: "Failed to fetch customers from Commerce 7",
      message: error.message 
    }, 500);
  }
});

// Get curated products with tonnage calculations
app.get("/backend-api/commerce7/curated-products", async (c) => {
  try {
    console.log('[Commerce7] Fetching curated products...');
    
    // Check cache
    if (isProductsCacheValid()) {
      console.log('[Commerce7] Using cached products data');
      const allProducts = productsCache.data;
      
      // Extract SKUs and product details
      const skuList = [];
      for (const product of allProducts) {
        const title = product.title || "";
        const variants = product.variants || [];
        
        for (const variant of variants) {
          const sku = variant.sku;
          if (!sku) continue;
          
          let totalInventory = 0;
          const variantInventory = variant.inventory || [];
          for (const invItem of variantInventory) {
            totalInventory += invItem.availableForSaleCount || 0;
          }
          
          // Get varietal from wine object
          const varietal = product.wine?.varietal || 'Unknown';
          const volumeInML = variant.volumeInML;
          
          skuList.push({
            sku,
            productTitle: title,
            variantTitle: variant.title || "",
            price: variant.price,
            productId: product.id,
            variantId: variant.id,
            isActive: variant.isActive,
            inventory: totalInventory,
            varietal,
            volumeInML
          });
        }
      }
      
      // Filter: remove nulls, no inventory, internal items, and cheap items
      const wineSkuPattern = /^(BBV|LIN)([A-Z]+)(\d{2})(\d{2}).*$/;
      const excludeSkus = ['tasting', 'ice', 'res', 'fled', 'soar'];
      
      let filtered = skuList.filter(item => {
        if (!item.sku || !item.price || item.inventory <= 0) return false;
        if (excludeSkus.includes(item.sku.trim().toLowerCase())) return false;
        if (item.price / 100 <= 1) return false;
        return wineSkuPattern.test(item.sku);
      });
      
      // Correct price by dividing by 100
      filtered = filtered.map(item => ({
        ...item,
        price: item.price / 100
      }));
      
      // Extract vintage and convert to four-digit year
      filtered = filtered.map(item => {
        const match = item.sku.match(/^(?:BBV|LIN)[A-Z]*(\d{2})/);
        let vintage = match ? parseInt(match[1]) : -1;
        
        let vintageFull = -1;
        if (vintage !== -1) {
          vintageFull = vintage >= 70 ? 1900 + vintage : 2000 + vintage;
        }
        
        return { ...item, vintage, vintageFull };
      });
      
      // Get 8 most recent vintages
      const validVintages = filtered
        .filter(item => item.vintageFull !== -1)
        .map(item => item.vintageFull);
      const uniqueVintages = [...new Set(validVintages)].sort((a, b) => b - a);
      const recentVintages = uniqueVintages.slice(0, 8);
      
      // Filter for recent vintages with positive inventory
      filtered = filtered.filter(item => 
        recentVintages.includes(item.vintageFull) && item.inventory > 0
      );
      
      // Filter out large format (>750mL)
      filtered = filtered.filter(item => item.volumeInML && item.volumeInML <= 750);
      
      // Filter out etched bottles (SKUs containing 'ET')
      filtered = filtered.filter(item => !item.sku.toLowerCase().includes('et'));
      
      // Filter out twilight wines
      filtered = filtered.filter(item => 
        !item.sku.toLowerCase().includes('twi') && 
        !item.productTitle.toLowerCase().includes('twilight')
      );
      
      // Apply varietal mappings based on product title
      const varietalMappings = {
        'Paramour': 'Cab Franc',
        'Contrarian': 'Cabernet Sauvignon',
        'Illustration': 'Merlot',
        'Arise': 'Mixed Variety'
      };
      
      for (const [keyword, newVarietal] of Object.entries(varietalMappings)) {
        filtered = filtered.map(item => {
          if (item.productTitle.toLowerCase().includes(keyword.toLowerCase())) {
            return { ...item, varietal: newVarietal };
          }
          return item;
        });
      }
      
      // Apply SKU-based varietal mappings
      const skuVarietalMappings = {
        'BBVSB': 'Sauvignon Blanc',
        'BBVAR': 'Rosé',
        'BBVCH': 'Chardonnay',
        'BBVAL': 'Albarino',
        'BBVBN': 'Cabernet Sauvignon',
        'BBVCF': 'Cabernet Franc'
      };
      
      for (const [prefix, newVarietal] of Object.entries(skuVarietalMappings)) {
        filtered = filtered.map(item => {
          if (item.sku.startsWith(prefix)) {
            return { ...item, varietal: newVarietal };
          }
          return item;
        });
      }
      
      // Calculate tonnage equivalents
      const ML_TO_GALLON_FACTOR = 3785.41;
      const LITERS_PER_CASE = 9;
      const CASES_PER_TON = 50;
      const LITERS_PER_TON = CASES_PER_TON * LITERS_PER_CASE;
      const GALLONS_PER_LITER = 1000 / ML_TO_GALLON_FACTOR;
      const GALLONS_PER_TON_GRAPES = LITERS_PER_TON * GALLONS_PER_LITER;
      
      const curatedProducts = filtered.map(item => {
        const volumeGallonsPerUnit = item.volumeInML / ML_TO_GALLON_FACTOR;
        const totalGallonsCurrentInventory = item.inventory * volumeGallonsPerUnit;
        const tonsOfGrapesEquivalent = totalGallonsCurrentInventory / GALLONS_PER_TON_GRAPES;
        
        return {
          sku: item.sku,
          price: item.price,
          productId: item.productId,
          inventory: item.inventory,
          varietal: item.varietal,
          volumeInML: item.volumeInML,
          vintageFull: item.vintageFull,
          volumeGallonsPerUnit,
          totalGallonsCurrentInventory,
          tonsOfGrapesEquivalent
        };
      });
      
      // Calculate summary statistics
      const totalTons = curatedProducts.reduce((sum, p) => sum + p.tonsOfGrapesEquivalent, 0);
      const totalValue = curatedProducts.reduce((sum, p) => sum + (p.price * p.inventory), 0);
      const totalBottles = curatedProducts.reduce((sum, p) => sum + p.inventory, 0);
      
      // Group by varietal
      const byVarietal = {};
      for (const product of curatedProducts) {
        if (!byVarietal[product.varietal]) {
          byVarietal[product.varietal] = {
            varietal: product.varietal,
            bottles: 0,
            tons: 0,
            value: 0
          };
        }
        byVarietal[product.varietal].bottles += product.inventory;
        byVarietal[product.varietal].tons += product.tonsOfGrapesEquivalent;
        byVarietal[product.varietal].value += product.price * product.inventory;
      }
      
      const varietalBreakdown = Object.values(byVarietal).sort((a, b) => b.tons - a.tons);
      
      console.log(`[Commerce7] Curated products: ${curatedProducts.length}, Total tons: ${totalTons.toFixed(2)}`);
      
      return c.json({
        products: curatedProducts,
        summary: {
          totalProducts: curatedProducts.length,
          totalBottles,
          totalTons: parseFloat(totalTons.toFixed(2)),
          totalValue: parseFloat(totalValue.toFixed(2)),
          averageBottlePrice: totalBottles > 0 ? parseFloat((totalValue / totalBottles).toFixed(2)) : 0
        },
        varietalBreakdown
      });
    }

    // Fetch all products with pagination
    const allProducts = [];
    let page = 1;
    
    while (true) {
      const data = await commerce7Request(`/product?page=${page}&limit=50`);
      const products = data.products || [];
      
      if (products.length === 0) {
        console.log(`[Commerce7] All product pages fetched. Total pages: ${page - 1}`);
        break;
      }
      
      allProducts.push(...products);
      page++;
      
      // Global queue handles rate limiting automatically
      
      // Safety limit: products have fewer pages typically
      if (page > 50) {
        console.log('[Commerce7] Reached pagination safety limit (50 pages)');
        break;
      }
    }
    
    console.log(`[Commerce7] Fetched ${allProducts.length} total products`);
    
    // Cache the products data
    productsCache = { data: allProducts, timestamp: Date.now() };
    
    // Extract SKUs and product details
    const skuList = [];
    for (const product of allProducts) {
      const title = product.title || "";
      const variants = product.variants || [];
      
      for (const variant of variants) {
        const sku = variant.sku;
        if (!sku) continue;
        
        let totalInventory = 0;
        const variantInventory = variant.inventory || [];
        for (const invItem of variantInventory) {
          totalInventory += invItem.availableForSaleCount || 0;
        }
        
        // Get varietal from wine object
        const varietal = product.wine?.varietal || 'Unknown';
        const volumeInML = variant.volumeInML;
        
        skuList.push({
          sku,
          productTitle: title,
          variantTitle: variant.title || "",
          price: variant.price,
          productId: product.id,
          variantId: variant.id,
          isActive: variant.isActive,
          inventory: totalInventory,
          varietal,
          volumeInML
        });
      }
    }
    
    // Filter: remove nulls, no inventory, internal items, and cheap items
    const wineSkuPattern = /^(BBV|LIN)([A-Z]+)(\d{2})(\d{2}).*$/;
    const excludeSkus = ['tasting', 'ice', 'res', 'fled', 'soar'];
    
    let filtered = skuList.filter(item => {
      if (!item.sku || !item.price || item.inventory <= 0) return false;
      if (excludeSkus.includes(item.sku.trim().toLowerCase())) return false;
      if (item.price / 100 <= 1) return false;
      return wineSkuPattern.test(item.sku);
    });
    
    // Correct price by dividing by 100
    filtered = filtered.map(item => ({
      ...item,
      price: item.price / 100
    }));
    
    // Extract vintage and convert to four-digit year
    filtered = filtered.map(item => {
      const match = item.sku.match(/^(?:BBV|LIN)[A-Z]*(\d{2})/);
      let vintage = match ? parseInt(match[1]) : -1;
      
      let vintageFull = -1;
      if (vintage !== -1) {
        vintageFull = vintage >= 70 ? 1900 + vintage : 2000 + vintage;
      }
      
      return { ...item, vintage, vintageFull };
    });
    
    // Get 8 most recent vintages
    const validVintages = filtered
      .filter(item => item.vintageFull !== -1)
      .map(item => item.vintageFull);
    const uniqueVintages = [...new Set(validVintages)].sort((a, b) => b - a);
    const recentVintages = uniqueVintages.slice(0, 8);
    
    // Filter for recent vintages with positive inventory
    filtered = filtered.filter(item => 
      recentVintages.includes(item.vintageFull) && item.inventory > 0
    );
    
    // Filter out large format (>750mL)
    filtered = filtered.filter(item => item.volumeInML && item.volumeInML <= 750);
    
    // Filter out etched bottles (SKUs containing 'ET')
    filtered = filtered.filter(item => !item.sku.toLowerCase().includes('et'));
    
    // Filter out twilight wines
    filtered = filtered.filter(item => 
      !item.sku.toLowerCase().includes('twi') && 
      !item.productTitle.toLowerCase().includes('twilight')
    );
    
    // Apply varietal mappings based on product title
    const varietalMappings = {
      'Paramour': 'Cab Franc',
      'Contrarian': 'Cabernet Sauvignon',
      'Illustration': 'Merlot',
      'Arise': 'Mixed Variety'
    };
    
    for (const [keyword, newVarietal] of Object.entries(varietalMappings)) {
      filtered = filtered.map(item => {
        if (item.productTitle.toLowerCase().includes(keyword.toLowerCase())) {
          return { ...item, varietal: newVarietal };
        }
        return item;
      });
    }
    
    // Apply SKU-based varietal mappings
    const skuVarietalMappings = {
      'BBVSB': 'Sauvignon Blanc',
      'BBVAR': 'Rosé',
      'BBVCH': 'Chardonnay',
      'BBVAL': 'Albarino',
      'BBVBN': 'Cabernet Sauvignon',
      'BBVCF': 'Cabernet Franc'
    };
    
    for (const [prefix, newVarietal] of Object.entries(skuVarietalMappings)) {
      filtered = filtered.map(item => {
        if (item.sku.startsWith(prefix)) {
          return { ...item, varietal: newVarietal };
        }
        return item;
      });
    }
    
    // Calculate tonnage equivalents
    const ML_TO_GALLON_FACTOR = 3785.41;
    const LITERS_PER_CASE = 9;
    const CASES_PER_TON = 50;
    const LITERS_PER_TON = CASES_PER_TON * LITERS_PER_CASE;
    const GALLONS_PER_LITER = 1000 / ML_TO_GALLON_FACTOR;
    const GALLONS_PER_TON_GRAPES = LITERS_PER_TON * GALLONS_PER_LITER;
    
    const curatedProducts = filtered.map(item => {
      const volumeGallonsPerUnit = item.volumeInML / ML_TO_GALLON_FACTOR;
      const totalGallonsCurrentInventory = item.inventory * volumeGallonsPerUnit;
      const tonsOfGrapesEquivalent = totalGallonsCurrentInventory / GALLONS_PER_TON_GRAPES;
      
      return {
        sku: item.sku,
        price: item.price,
        productId: item.productId,
        inventory: item.inventory,
        varietal: item.varietal,
        volumeInML: item.volumeInML,
        vintageFull: item.vintageFull,
        volumeGallonsPerUnit,
        totalGallonsCurrentInventory,
        tonsOfGrapesEquivalent
      };
    });
    
    // Calculate summary statistics
    const totalTons = curatedProducts.reduce((sum, p) => sum + p.tonsOfGrapesEquivalent, 0);
    const totalValue = curatedProducts.reduce((sum, p) => sum + (p.price * p.inventory), 0);
    const totalBottles = curatedProducts.reduce((sum, p) => sum + p.inventory, 0);
    
    // Group by varietal
    const byVarietal = {};
    for (const product of curatedProducts) {
      if (!byVarietal[product.varietal]) {
        byVarietal[product.varietal] = {
          varietal: product.varietal,
          bottles: 0,
          tons: 0,
          value: 0
        };
      }
      byVarietal[product.varietal].bottles += product.inventory;
      byVarietal[product.varietal].tons += product.tonsOfGrapesEquivalent;
      byVarietal[product.varietal].value += product.price * product.inventory;
    }
    
    const varietalBreakdown = Object.values(byVarietal).sort((a, b) => b.tons - a.tons);
    
    console.log(`[Commerce7] Curated products: ${curatedProducts.length}, Total tons: ${totalTons.toFixed(2)}`);
    
    return c.json({
      products: curatedProducts,
      summary: {
        totalProducts: curatedProducts.length,
        totalBottles,
        totalTons: parseFloat(totalTons.toFixed(2)),
        totalValue: parseFloat(totalValue.toFixed(2)),
        averageBottlePrice: totalBottles > 0 ? parseFloat((totalValue / totalBottles).toFixed(2)) : 0
      },
      varietalBreakdown
    });
  } catch (error) {
    console.error("[Commerce7] Error fetching curated products:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      products: [],
      summary: {},
      varietalBreakdown: []
    }, 500);
  }
});

// ========================================
// EXECUTIVE INSIGHT ENDPOINTS
// These provide aggregated data for dashboards
// Use these instead of raw pagination endpoints!
// ========================================

// Helper function: Fetch RECENT orders only (stops at cutoff date)
// This is the KEY FIX to prevent full history pagination
async function fetchRecentOrdersWithCache(daysBack = 120, force = false): Promise<any[]> {
  // Use in-memory cache if valid
  if (isOrdersCacheValid(force)) {
    console.log('[Insight] Using cached orders');
    return ordersCache!.data;
  }

  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  console.log(`[Insight] Fetching orders back ${daysBack} days (cutoff ${cutoff.toISOString()})`);

  const allOrders: any[] = [];
  let page = 1;

  while (true) {
    const data = await commerce7Request(`/order?page=${page}&limit=50`);
    const orders = data.orders || [];
    if (orders.length === 0) break;

    allOrders.push(...orders);

    // Find oldest order date in this page
    const oldest = orders
      .map((o: any) => new Date(o.createdAt || o.orderDate || o.purchasedAt || 0))
      .reduce((min: Date, d: Date) => (d < min ? d : min), new Date());

    // Stop paging once we've crossed the cutoff
    if (oldest < cutoff) {
      console.log(`[Insight] Hit cutoff at page ${page}. Stopping pagination.`);
      break;
    }

    page++;
    if (page > 150) {
      console.log('[Insight] Reached 150-page safety limit');
      break;
    }

    // Adaptive throttling: increase delay as we go deeper to avoid rate limits
    const throttleMs = page < 10 ? 400 : page < 30 ? 600 : 850;
    await sleep(throttleMs);
  }

  ordersCache = { data: allOrders, timestamp: Date.now() };
  console.log(`[Insight] Cached ${allOrders.length} recent orders (${daysBack} days)`);
  return allOrders;
}

// OLD FUNCTION - DEPRECATED - use fetchRecentOrdersWithCache instead
async function fetchAllOrdersWithCache(): Promise<any[]> {
  if (isOrdersCacheValid()) {
    console.log('[Insight] Using cached orders');
    return ordersCache!.data;
  }

  console.log('[Insight] Fetching fresh orders data...');
  const allOrders = [];
  let page = 1;
  
  while (true) {
    const data = await commerce7Request(`/order?page=${page}&limit=50`);
    const orders = data.orders || [];
    
    if (orders.length === 0) break;
    allOrders.push(...orders);
    page++;
    
    if (page > 150) {
      console.log('[Insight] Reached 150-page limit');
      break;
    }
  }

  ordersCache = { data: allOrders, timestamp: Date.now() };
  console.log(`[Insight] Cached ${allOrders.length} orders`);
  return allOrders;
}

async function fetchAllProductsWithCache(force = false): Promise<any[]> {
  if (isProductsCacheValid(force)) {
    console.log('[Insight] Using cached products');
    return productsCache!.data;
  }

  console.log('[Insight] Fetching fresh products data...');
  const allProducts = [];
  let page = 1;
  
  while (true) {
    const data = await commerce7Request(`/product?page=${page}&limit=50`);
    const products = data.products || [];
    
    if (products.length === 0) break;
    allProducts.push(...products);
    page++;
    
    if (page > 50) {
      console.log('[Insight] Reached 50-page limit');
      break;
    }

    // Throttle to avoid rate limits
    await sleep(400);
  }

  productsCache = { data: allProducts, timestamp: Date.now() };
  console.log(`[Insight] Cached ${allProducts.length} products`);
  return allProducts;
}

async function fetchAllCustomersWithCache(): Promise<any[]> {
  if (isCustomersCacheValid()) {
    console.log('[Insight] Using cached customers');
    return customersCache!.data;
  }

  console.log('[Insight] Fetching fresh customers data from Commerce7 API...');
  const allCustomers = [];
  let page = 1;
  
  try {
    while (true) {
      console.log(`[Insight] Fetching customers page ${page}...`);
      // FIX: Commerce7 requires limit <= 50
      const data = await commerce7Request(`/customer?page=${page}&limit=50`);
      
      // DEFENSIVE: Don't assume data.customers exists
      const customers = Array.isArray(data?.customers) ? data.customers : [];
      
      // Debug schema issues on page 1
      if (page === 1 && customers.length === 0 && data) {
        console.log(`[Insight] Page 1 returned 0 customers - raw keys:`, Object.keys(data));
      }
      
      console.log(`[Insight] Page ${page} returned ${customers.length} customers`);
      
      if (customers.length === 0) break;
      allCustomers.push(...customers);
      page++;
      
      // Safety limit: 200 pages × 50 = 10,000 customers max
      if (page > 200) {
        console.log('[Insight] Reached 200-page safety limit for customers');
        break;
      }

      // Throttle to avoid rate limits
      await sleep(400);
    }

    customersCache = { data: allCustomers, timestamp: Date.now() };
    console.log(`[Insight] Successfully cached ${allCustomers.length} customers`);
    return allCustomers;
  } catch (error) {
    console.error('[Insight] Error fetching customers:', error);
    console.error('[Insight] Error details:', error instanceof Error ? error.message : String(error));
    // Return empty array instead of throwing to prevent cascade failures
    return [];
  }
}

// NEW: Selective customer fetch - only gets specific customer IDs
async function fetchSelectiveCustomers(customerIds: Set<string>): Promise<Map<string, any>> {
  const customerMap = new Map<string, any>();
  
  if (customerIds.size === 0) {
    return customerMap;
  }
  
  console.log(`[Insight] Fetching ${customerIds.size} specific customers via throttled pagination...`);
  
  let page = 1;
  const maxPages = 15; // Search up to 750 customers (15 pages × 50)
  let foundCount = 0;
  const THROTTLE_DELAY_MS = 200; // 200ms delay between requests to avoid rate limit
  
  try {
    while (page <= maxPages && foundCount < customerIds.size) {
      // Throttle: Add delay between requests to respect rate limits
      if (page > 1) {
        await sleep(THROTTLE_DELAY_MS);
      }
      
      const data = await commerce7Request(`/customer?page=${page}&limit=50`);
      const customers = Array.isArray(data?.customers) ? data.customers : [];
      
      console.log(`[Insight] Page ${page}: Received ${customers.length} customers from API`);
      
      if (customers.length === 0) {
        console.log(`[Insight] No more customers found at page ${page}`);
        break;
      }
      
      // DEBUG: Log first few customer IDs on first page to compare with what we're looking for
      if (page === 1 && customers.length > 0) {
        console.log(`[Insight] DEBUG - First 3 customer IDs from API:`, customers.slice(0, 3).map(c => c.id));
        console.log(`[Insight] DEBUG - Looking for these customer IDs:`, Array.from(customerIds).slice(0, 5));
      }
      
      // Check each customer in this page
      for (const customer of customers) {
        if (customerIds.has(customer.id)) {
          customerMap.set(customer.id, customer);
          foundCount++;
          console.log(`[Insight] ✓ Found customer ${customer.id} on page ${page} (${foundCount}/${customerIds.size})`);
          
          // DEBUG: Log first customer's fields to identify correct email property
          if (foundCount === 1) {
            console.log(`[Insight] DEBUG - Customer object keys:`, Object.keys(customer));
            console.log(`[Insight] DEBUG - Customer sample:`, JSON.stringify({
              id: customer.id,
              email: customer.email,
              emailAddress: customer.emailAddress,
              firstName: customer.firstName,
              lastName: customer.lastName,
            }));
          }
          
          // Early exit if we found all needed customers
          if (foundCount === customerIds.size) {
            console.log(`[Insight] ✅ Found all ${customerIds.size} customers in ${page} pages`);
            return customerMap;
          }
        }
      }
      
      page++;
    }
    
    const missingCount = customerIds.size - foundCount;
    console.log(`[Insight] Customer fetch complete: ${foundCount}/${customerIds.size} found in ${page - 1} pages${missingCount > 0 ? ` (${missingCount} still missing)` : ''}`);
    return customerMap;
  } catch (error) {
    console.error('[Insight] Error in selective customer fetch:', error);
    return customerMap;
  }
}

// Executive Overview - Top-level KPIs (15-min TTL recommended)
app.get("/backend-api/dash/exec/overview", async (c) => {
  try {
    console.log('[Dash] Executive Overview requested');
    
    const [orders, products] = await Promise.all([
      fetchAllOrdersWithCache(),
      fetchAllProductsWithCache()
    ]);

    // Calculate rolling 30/90 day sales
    const now = new Date();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const orders30d = orders.filter(o => new Date(o.orderDate || o.createdAt) >= days30Ago);
    const orders90d = orders.filter(o => new Date(o.orderDate || o.createdAt) >= days90Ago);

    const revenue30d = orders30d.reduce((sum, o) => sum + (o.total || 0), 0) / 100;
    const revenue90d = orders90d.reduce((sum, o) => sum + (o.total || 0), 0) / 100;

    // Total inventory (simplified - you'll enhance this with curated logic)
    const totalInventory = products.reduce((sum, p) => {
      return sum + (p.variants || []).reduce((vsum: number, v: any) => {
        return vsum + (v.inventory || []).reduce((isum: number, inv: any) => {
          return isum + (inv.availableForSaleCount || 0);
        }, 0);
      }, 0);
    }, 0);

    return c.json({
      revenue: {
        last30Days: parseFloat(revenue30d.toFixed(2)),
        last90Days: parseFloat(revenue90d.toFixed(2)),
        dailyAvg30d: parseFloat((revenue30d / 30).toFixed(2)),
        dailyAvg90d: parseFloat((revenue90d / 90).toFixed(2))
      },
      orders: {
        last30Days: orders30d.length,
        last90Days: orders90d.length
      },
      inventory: {
        totalBottles: totalInventory,
        totalProducts: products.length
      },
      cacheAge: ordersCache ? Math.floor((Date.now() - ordersCache.timestamp) / 1000) : 0
    });
  } catch (error) {
    console.error('[Dash] Error in exec/overview:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Top Movers - Best selling SKUs by rolling window
app.get("/backend-api/dash/exec/top-movers", async (c) => {
  try {
    const window = parseInt(c.req.query("window") || "90"); // days
    const limit = parseInt(c.req.query("limit") || "10");
    
    console.log(`[Dash] Top Movers requested (${window}d, limit ${limit})`);
    
    const orders = await fetchAllOrdersWithCache();
    
    const cutoffDate = new Date(Date.now() - window * 24 * 60 * 60 * 1000);
    const recentOrders = orders.filter(o => new Date(o.orderDate || o.createdAt) >= cutoffDate);

    // Aggregate by SKU
    const skuSales: Record<string, { sku: string; productTitle: string; quantity: number; revenue: number }> = {};
    
    for (const order of recentOrders) {
      for (const item of (order.orderItems || [])) {
        const sku = item.sku || item.productVariantId || 'unknown';
        const productTitle = item.title || item.productTitle || sku; // Get the product title from order item
        if (!skuSales[sku]) {
          skuSales[sku] = { sku, productTitle, quantity: 0, revenue: 0 };
        }
        skuSales[sku].quantity += item.quantity || 0;
        skuSales[sku].revenue += (item.total || 0) / 100;
      }
    }

    const topMovers = Object.values(skuSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);

    return c.json({ topMovers, window, limit });
  } catch (error) {
    console.error('[Dash] Error in exec/top-movers:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ========================================
// CONSOLIDATED DASHBOARD ENDPOINT WITH SWR + ADVISORY LOCK
// This is the ONLY endpoint Figma should call
// ========================================

const DASH_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DASH_LOCK_KEY = 1;
const DASH_LOCK_TTL_MS = 60 * 1000; // 60 seconds - auto-expire if process crashes

// Helper: Try to acquire lock using KV store
async function tryAcquireLock(): Promise<boolean> {
  try {
    const lock = await kv.get<{ timestamp: number }>(`lock:${DASH_LOCK_KEY}`);
    if (lock && Date.now() - lock.timestamp < DASH_LOCK_TTL_MS) {
      return false;
    }
    await kv.set(`lock:${DASH_LOCK_KEY}`, { timestamp: Date.now() });
    return true;
  } catch (err) {
    console.error('[Lock] Exception acquiring lock:', err);
    // Graceful fallback - proceed anyway
    return true;
  }
}

// Helper: Release lock
async function releaseLock(): Promise<void> {
  try {
    await kv.del(`lock:${DASH_LOCK_KEY}`);
    console.log('[Lock] Released');
  } catch (err) {
    console.error('[Lock] Exception releasing lock:', err);
  }
}

// Helper: Read cache from KV store
async function readDashCache(): Promise<{ payload: any; timestamp: number } | null> {
  try {
    const DASH_CACHE_KEY = 'dash_exec_cache_v1'; // v1: simple order totals
    const cached = await kv.get(DASH_CACHE_KEY) as { payload: any; timestamp: number } | null;
    if (!cached) return null;
    
    console.log(`[Cache] Read from KV, age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s`);
    return cached;
  } catch (error) {
    console.error('[Cache] Error reading cache:', error);
    return null;
  }
}

// Helper: Write cache to KV store
async function writeDashCache(payload: any): Promise<void> {
  try {
    const DASH_CACHE_KEY = 'dash_exec_cache_v1'; // v1: simple order totals
    const cacheEntry = {
      payload,
      timestamp: Date.now()
    };
    await kv.set(DASH_CACHE_KEY, cacheEntry);
    console.log('[Cache] Written to KV');
  } catch (error) {
    console.error('[Cache] Error writing cache:', error);
  }
}

// ========================================
// DEFENSIVE DATA EXTRACTION HELPERS
// Commerce7 API field names vary across endpoints/versions
// ========================================

function getOrderDate(order: any): Date | null {
  const raw =
    order.orderSubmittedDate ||
    order.orderDate ||
    order.createdAt ||
    order.purchasedAt ||
    order.processedAt;

  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

function getLineItems(order: any): any[] {
  if (Array.isArray(order.items)) return order.items;
  if (Array.isArray(order.orderItems)) return order.orderItems;
  if (Array.isArray(order.lineItems)) return order.lineItems;
  if (order.items && Array.isArray(order.items.items)) return order.items.items;
  return [];
}

function getQty(item: any): number {
  const q = item.quantity ?? item.qty ?? item.count ?? 0;
  const n = typeof q === "number" ? q : parseFloat(q);
  return Number.isFinite(n) ? n : 0;
}

function getSku(item: any): string {
  return item.sku || item.productSku || item.variantSku || item.productVariantId || "unknown";
}

// CRITICAL: For curated wine revenue, ONLY trust item.sku (no fallback to IDs)
function getItemSku(item: any): string | null {
  const s = (item?.sku || "").trim();
  return s ? s : null;
}

// Get variant ID from order line item (for SKU resolution)
function getVariantId(item: any): string | null {
  return (item?.productVariantId || item?.variantId || item?.variant?.id || "").toString().trim() || null;
}

// Resolve SKU from order item: try direct SKU first, then fall back to variantId lookup
function resolveOrderSku(item: any, skuByVariantId: Map<string, string>): string | null {
  // Try direct SKU first
  const direct = (item?.sku || "").trim();
  if (direct) return direct;

  // Fall back to variant ID lookup
  const vid = getVariantId(item);
  if (vid && skuByVariantId.has(vid)) {
    return skuByVariantId.get(vid)!;
  }

  return null;
}

// CRITICAL: Filter function to skip refunds/returns
function isPositiveSaleLine(item: any): boolean {
  const qty = getQty(item);
  if (qty <= 0) return false; // ✅ drop returns/refunds
  
  const rawTotal = item.total ?? item.lineTotal ?? item.extendedPrice ?? null;
  if (typeof rawTotal === "number" && rawTotal < 0) return false; // �� drop negative totals
  
  return true;
}

// Convert cents to dollars (Commerce7 typically uses cents)
function centsToDollars(x: any): number {
  if (typeof x !== "number" || !isFinite(x)) return 0;
  return x / 100;
}

function dollarsFromCents(x: any): number {
  if (typeof x !== "number" || !isFinite(x)) return 0;
  // Commerce7 money fields are cents; use abs to handle negatives
  return Math.abs(x) >= 5 ? x / 100 : x;
}

// Get order total in dollars (real money collected)
function orderTotalDollars(order: any): number {
  const raw = order.total ?? order.grandTotal ?? order.orderTotal ?? 0;
  return centsToDollars(raw);
}

// Allocate revenue across curated items in an order proportional to catalog revenue
// This handles discounts/promos/club pricing by distributing actual order.total
function allocateCuratedRevenueForOrder(
  order: any,
  curatedSkus: Set<string>,
  skuByVariantId: Map<string, string>,
  priceBySku: Map<string, number>,
): { revenue: number; bottles: number; skuRevenue: Record<string, { revenue: number; qty: number }> } {
  const total = orderTotalDollars(order);
  if (total <= 0) return { revenue: 0, bottles: 0, skuRevenue: {} };

  const items = getLineItems(order);

  // Build curated catalog subtotal for this order
  const curatedLines: { sku: string; qty: number; catalog: number }[] = [];
  let curatedCatalogSubtotal = 0;
  let bottles = 0;

  for (const it of items) {
    const sku = resolveOrderSku(it, skuByVariantId);
    if (!sku || !curatedSkus.has(sku)) continue;

    const qty = getQty(it);
    if (qty <= 0) continue;

    const price = priceBySku.get(sku) ?? 0; // dollars
    const catalog = qty * price;

    curatedLines.push({ sku, qty, catalog });
    curatedCatalogSubtotal += catalog;
    bottles += qty;
  }

  // If nothing curated in this order, return nothing
  if (curatedLines.length === 0) return { revenue: 0, bottles: 0, skuRevenue: {} };

  // Allocate full order total only across curated lines.
  const skuRevenue: Record<string, { revenue: number; qty: number }> = {};

  // If curatedCatalogSubtotal is 0 (edge case), fall back to equal split by qty
  if (curatedCatalogSubtotal <= 0) {
    const totalQty = curatedLines.reduce((s, x) => s + x.qty, 0) || 1;
    for (const l of curatedLines) {
      const alloc = total * (l.qty / totalQty);
      if (!skuRevenue[l.sku]) skuRevenue[l.sku] = { revenue: 0, qty: 0 };
      skuRevenue[l.sku].revenue += alloc;
      skuRevenue[l.sku].qty += l.qty;
    }
    return { revenue: total, bottles, skuRevenue };
  }

  for (const l of curatedLines) {
    const alloc = total * (l.catalog / curatedCatalogSubtotal);
    if (!skuRevenue[l.sku]) skuRevenue[l.sku] = { revenue: 0, qty: 0 };
    skuRevenue[l.sku].revenue += alloc;
    skuRevenue[l.sku].qty += l.qty;
  }

  return { revenue: total, bottles, skuRevenue };
}

// DEPRECATED - keeping for backward compat but not used in dashboard
function getItemQuantity(item: any): number {
  return getQty(item);
}

// Build curated SKU set from product catalog ONLY (no inventory filter for sales history)
async function buildCuratedSkuSet(): Promise<Set<string>> {
  console.log('[CuratedSKUs] Building curated SKU set from product catalog...');
  const products = await fetchAllProductsWithCache();
  
  const wineSkuPattern = /^(BBV|LIN)[A-Z]+(\d{2})(\d{2}).*$/i;
  const excludeSkus = new Set(['tasting', 'ice', 'res', 'fled', 'soar']);
  
  const curatedSkus = new Set<string>();
  
  for (const product of products) {
    const title = (product.title || '').toLowerCase();
    if (title.includes('twilight')) continue;
    
    const variants = product.variants || [];
    
    for (const variant of variants) {
      const sku = (variant.sku || '').trim();
      if (!sku) continue;
      
      const skuLower = sku.toLowerCase();
      if (excludeSkus.has(skuLower)) continue;
      if (skuLower.includes('et')) continue;     // etched
      if (skuLower.includes('twi')) continue;    // twilight
      if (!wineSkuPattern.test(sku)) continue;
      
      const vol = variant.volumeInML ?? null;
      if (typeof vol === 'number' && vol > 750) continue; // no large format
      
      // price sanity (Commerce7 price usually in cents)
      const price = variant.price ?? null;
      if (typeof price === 'number' && price <= 100) continue; // <= $1
      
      curatedSkus.add(sku);
    }
  }
  
  console.log(`[CuratedSKUs] Built set with ${curatedSkus.size} curated SKUs (no inventory filter)`);
  return curatedSkus;
}

async function buildSkuMaps(force = false): Promise<{
  curatedSkus: Set<string>;
  priceBySku: Map<string, number>;
  titleBySku: Map<string, string>;
  skuByVariantId: Map<string, string>;
}> {
  const products = await fetchAllProductsWithCache(force);

  const wineSkuPattern = /^(BBV|LIN)[A-Z]+(\d{2})(\d{2}).*$/i;
  const excludeSkus = new Set(["tasting", "ice", "res", "fled", "soar"]);

  const curatedSkus = new Set<string>();
  const priceBySku = new Map<string, number>();
  const titleBySku = new Map<string, string>();
  const skuByVariantId = new Map<string, string>();

  for (const product of products) {
    const productTitle = (product.title || "").trim();
    const titleLower = productTitle.toLowerCase();
    if (titleLower.includes("twilight")) continue;

    for (const variant of product.variants || []) {
      const sku = (variant.sku || "").trim();
      if (!sku) continue;

      const skuLower = sku.toLowerCase();
      if (excludeSkus.has(skuLower)) continue;
      if (skuLower.includes("et")) continue;
      if (skuLower.includes("twi")) continue;
      if (!wineSkuPattern.test(sku)) continue;

      const vol = variant.volumeInML;
      if (typeof vol === "number" && vol > 750) continue;

      const priceCents = variant.price;
      if (typeof priceCents !== "number" || priceCents <= 100) continue; // <= $1

      curatedSkus.add(sku);
      priceBySku.set(sku, priceCents / 100);
      titleBySku.set(sku, productTitle || sku);
      
      // Map variant ID to SKU for orders that don't carry SKU directly
      if (variant.id) {
        skuByVariantId.set(String(variant.id), sku);
      }
    }
  }

  console.log(`[SKU MAP] curatedSkus=${curatedSkus.size}, priceBySku=${priceBySku.size}, variantIdMappings=${skuByVariantId.size}`);
  return { curatedSkus, priceBySku, titleBySku, skuByVariantId };
}

// Compute revenue from item.total ONLY (omit anything without total or <= 0)
function itemRevenueDollars(item: any): number {
  const q = Number(item?.quantity ?? 0);
  if (!isFinite(q) || q <= 0) return 0;

  const rawTotal = item?.total ?? item?.lineTotal ?? item?.extendedPrice ?? null;
  if (typeof rawTotal === "number") {
    const r = dollarsFromCents(rawTotal);
    return r > 0 ? r : 0; // omit refunds/negatives entirely
  }

  // if no total exists, bail (don't reconstruct with list price)
  return 0;
}

// DEPRECATED - Don't use these for dashboard revenue
function getItemRevenueDollars(item: any): number {
  const total = item.total ?? item.totalPrice ?? item.subtotal ?? 0;
  if (total < 0) return 0;
  if (typeof total === "number") {
    return total > 1000 ? total / 100 : total;
  }
  const n = parseFloat(total) || 0;
  if (n < 0) return 0;
  return n > 1000 ? n / 100 : n;
}

function getOrderRevenueDollars(order: any): number {
  const orderTotal = order.total ?? order.grandTotal ?? 0;
  if (orderTotal < 0) return 0;
  if (typeof orderTotal === "number") {
    return orderTotal > 1000 ? orderTotal / 100 : orderTotal;
  }
  const n = parseFloat(orderTotal) || 0;
  if (n < 0) return 0;
  return n > 1000 ? n / 100 : n;
}

// Helper: Compute full dashboard payload (aggregations from cached data)
async function computeDashboardPayload(force = false): Promise<any> {
  console.log("[Compute] Building dashboard payload...");

  // Fetch 180 days to reduce API load (temporary stabilizer)
  const orders = await fetchRecentOrdersWithCache(180, force);
  console.log(`[Compute] Loaded ${orders.length} orders (180d for stability)`);

  const { curatedSkus, priceBySku, titleBySku, skuByVariantId } = await buildSkuMaps(force);

// --- DEBUG COUNTERS ---
let dbg_lines = 0;
let dbg_hasDirectSku = 0;
let dbg_hasVariantId = 0;
let dbg_resolvedSku = 0;
let dbg_inCurated = 0;
let dbg_hasPositiveTotal = 0;

for (const o of orders.slice(0, 50)) { // only sample 50 orders
  for (const it of getLineItems(o)) {
    dbg_lines++;

    if ((it?.sku || "").trim()) dbg_hasDirectSku++;

    const vid = (it?.productVariantId || it?.variantId || it?.variant?.id || "").toString().trim();
    if (vid) dbg_hasVariantId++;

    const sku = resolveOrderSku(it, skuByVariantId);
    if (sku) dbg_resolvedSku++;

    if (sku && curatedSkus.has(sku)) dbg_inCurated++;

    const raw = it.total ?? it.lineTotal ?? it.extendedPrice ?? null;
    if (typeof raw === "number" && raw > 0) dbg_hasPositiveTotal++;
  }
}

console.log("[DEBUG] lines:", dbg_lines);
console.log("[DEBUG] hasDirectSku:", dbg_hasDirectSku);
console.log("[DEBUG] hasVariantId:", dbg_hasVariantId);
console.log("[DEBUG] resolvedSku:", dbg_resolvedSku);
console.log("[DEBUG] resolvedSkuInCurated:", dbg_inCurated);
console.log("[DEBUG] hasPositiveTotal:", dbg_hasPositiveTotal);
console.log("[DEBUG] curatedSkuCount:", curatedSkus.size);

  
  const now = new Date();
  const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const orders30d = orders.filter((o) => {
    const d = getOrderDate(o);
    return d && d >= days30Ago;
  });

  const orders90d = orders.filter((o) => {
    const d = getOrderDate(o);
    return d && d >= days90Ago;
  });

  // ---- Revenue + bottles from curated line items ----
  // Use allocation to distribute actual order.total across curated items
  let revenue30d = 0;
  let bottles30d = 0;

  for (const order of orders30d) {
    const alloc = allocateCuratedRevenueForOrder(order, curatedSkus, skuByVariantId, priceBySku);
    revenue30d += alloc.revenue;
    bottles30d += alloc.bottles;
  }

  let revenue90d = 0;
  let bottles90d = 0;

  for (const order of orders90d) {
    const alloc = allocateCuratedRevenueForOrder(order, curatedSkus, skuByVariantId, priceBySku);
    revenue90d += alloc.revenue;
    bottles90d += alloc.bottles;
  }

  console.log(`[Compute] 30d curated revenue: $${revenue30d.toFixed(2)} bottles=${bottles30d}`);
  console.log(`[Compute] 90d curated revenue: $${revenue90d.toFixed(2)} bottles=${bottles90d}`);

  // ---- Monthly trend (needs bottles for your chart) ----
  const monthlyMap: Record<string, { monthKey: string; revenue: number; bottles: number; orders: number }> = {};

  for (const order of orders90d) {
    const d = getOrderDate(order);
    if (!d) continue;

    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[key]) monthlyMap[key] = { monthKey: key, revenue: 0, bottles: 0, orders: 0 };

    const alloc = allocateCuratedRevenueForOrder(order, curatedSkus, skuByVariantId, priceBySku);

    if (alloc.revenue > 0 || alloc.bottles > 0) {
      monthlyMap[key].revenue += alloc.revenue;
      monthlyMap[key].bottles += alloc.bottles;
      monthlyMap[key].orders += 1;
    }
  }

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const monthlyTrend = Object.values(monthlyMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-3)  // 🔥 Only take last 3 months (trailing window)
    .map((m) => {
      const [year, mm] = m.monthKey.split("-");
      const label = `${monthNames[parseInt(mm, 10) - 1]} ${year}`;
      return {
        month: label,
        revenue: parseFloat(m.revenue.toFixed(2)),
        bottles: m.bottles,
        orders: m.orders,
      };
    });

  // ---- Top movers by SKU (revenue allocated from order totals) ----
  const skuAgg: Record<string, { sku: string; productTitle: string; quantity: number; revenue: number }> = {};

  for (const order of orders90d) {
    const alloc = allocateCuratedRevenueForOrder(order, curatedSkus, skuByVariantId, priceBySku);

    for (const [sku, v] of Object.entries(alloc.skuRevenue)) {
      if (!skuAgg[sku]) {
        skuAgg[sku] = { sku, productTitle: titleBySku.get(sku) ?? sku, quantity: 0, revenue: 0 };
      }
      skuAgg[sku].quantity += v.qty;
      skuAgg[sku].revenue += v.revenue;
    }
  }

  const topMovers = Object.values(skuAgg)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)
    .map((x) => ({
      sku: x.sku,
      productTitle: x.productTitle,
      quantity: x.quantity,
      revenue: parseFloat(x.revenue.toFixed(2)),
    }));

  // ---- Inventory (leave as you had it or later make it curated-only) ----
  const products = await fetchAllProductsWithCache();
  let totalInventory = 0;
  for (const product of products) {
    for (const variant of product.variants || []) {
      for (const inv of variant.inventory || []) {
        totalInventory += inv.availableForSaleCount || 0;
      }
    }
  }

  // ---- EFFICIENT Customer Analytics (orders-first approach) ----
  console.log('[Compute] Building customer analytics (curated revenue + bottles)...');
  let customerAnalytics = null;
  let currentStage = 'initialization';
  
  try {
    // 1) Build order-derived customer metrics (90d + 120d windows)
    currentStage = 'building-metrics';
    type CustomerMetrics = {
      customerId: string;
      revenue90d: number;
      revenue365d: number; // T12M for LTV
      revenueAllTime: number; // ALL TIME - true LTV
      orders90d: number;
      orders365d: number;
      ordersAllTime: number;
      bottles90d: number;
      bottles365d: number;
      bottlesAllTime: number;
      firstOrderDate: Date | null;
      lastOrderDate: Date | null;
      email?: string; // Captured from order.customer
      firstName?: string;
      lastName?: string;
    };
    
    const customerMetrics = new Map<string, CustomerMetrics>();
    const now = Date.now();
    const ms90d = 90 * 24 * 60 * 60 * 1000;
    const ms365d = 365 * 24 * 60 * 60 * 1000; // T12M window
    const ms30d = 30 * 24 * 60 * 60 * 1000;
    
    // Process all orders (365d) to build 90d + T12M metrics
    let orderDebugCount = 0;
    for (const order of orders) {
      const customerId = order.customerId || order.customer?.id;
      if (!customerId) continue;
      
      // DEBUG: Log first order's customer structure
      if (orderDebugCount === 0) {
        console.log(`[Insight] DEBUG - First order customer structure:`, JSON.stringify({
          customerId: order.customerId,
          'customer.id': order.customer?.id,
          'customer.email': order.customer?.email,
          'customer.emailAddress': order.customer?.emailAddress,
          'customer.firstName': order.customer?.firstName,
          'customer.lastName': order.customer?.lastName,
        }));
        orderDebugCount++;
      }
      
      const orderDate = getOrderDate(order);
      if (!orderDate) continue;
      
      // Use allocateCuratedRevenueForOrder to get curated revenue + bottles
      // NOTE: This only counts bottles from curated SKUs (brand wine mix)
      // TODO: Add separate tracking for "all wine bottles" vs "curated bottles"
      // to avoid showing 0 bottles for customers who bought non-curated items
      const alloc = allocateCuratedRevenueForOrder(order, curatedSkus, skuByVariantId, priceBySku);
      const orderRev = alloc.revenue;
      const orderBottles = alloc.bottles;
      const orderAge = now - orderDate.getTime();
      
      // Capture customer info from order payload (avoid extra API calls)
      const email = order.customer?.email || order.customer?.emailAddress || undefined;
      const firstName = order.customer?.firstName || undefined;
      const lastName = order.customer?.lastName || undefined;
      
      if (!customerMetrics.has(customerId)) {
        customerMetrics.set(customerId, {
          customerId,
          revenue90d: 0,
          revenue365d: 0,
          revenueAllTime: 0,
          orders90d: 0,
          orders365d: 0,
          ordersAllTime: 0,
          bottles90d: 0,
          bottles365d: 0,
          bottlesAllTime: 0,
          firstOrderDate: orderDate,
          lastOrderDate: orderDate,
          email,
          firstName,
          lastName,
        });
      }
      
      const metrics = customerMetrics.get(customerId)!;
      
      // Update customer info if this order has better data
      if (email && !metrics.email) metrics.email = email;
      if (firstName && !metrics.firstName) metrics.firstName = firstName;
      if (lastName && !metrics.lastName) metrics.lastName = lastName;
      
      // Update first/last order dates
      if (!metrics.firstOrderDate || orderDate < metrics.firstOrderDate) {
        metrics.firstOrderDate = orderDate;
      }
      if (!metrics.lastOrderDate || orderDate > metrics.lastOrderDate) {
        metrics.lastOrderDate = orderDate;
      }
      
      // All-time tracking (no time restriction)
      metrics.revenueAllTime += orderRev;
      metrics.ordersAllTime += 1;
      metrics.bottlesAllTime += orderBottles;
      
      // 90d window
      if (orderAge <= ms90d) {
        metrics.revenue90d += orderRev;
        metrics.orders90d += 1;
        metrics.bottles90d += orderBottles;
      }
      
      // T12M window (365d for LTV)
      if (orderAge <= ms365d) {
        metrics.revenue365d += orderRev;
        metrics.orders365d += 1;
        metrics.bottles365d += orderBottles;
      }
    }
    
    console.log(`[Compute] Built metrics for ${customerMetrics.size} unique customers from orders`);
    
    // 2) Top 5 customers by revenue (90d) - for outreach
    currentStage = 'top-customers-90d';
    const topCustomers90d = Array.from(customerMetrics.values())
      .filter(m => m.revenue90d > 0)
      .sort((a, b) => b.revenue90d - a.revenue90d)
      .slice(0, 5)
      .map(m => ({ 
        customerId: m.customerId, 
        revenue90d: m.revenue90d, 
        orders90d: m.orders90d, 
        bottles90d: m.bottles90d,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName
      }));
    
    // 3) Top 5 first-time purchasers (most recent within 30d)
    currentStage = 'new-customers-30d';
    const newCustomers30d = Array.from(customerMetrics.values())
      .filter(m => m.orders365d === 1 && m.firstOrderDate && (now - m.firstOrderDate.getTime()) <= ms30d)
      .sort((a, b) => b.firstOrderDate!.getTime() - a.firstOrderDate!.getTime())
      .slice(0, 5)
      .map(m => ({ 
        customerId: m.customerId, 
        firstOrderDate: m.firstOrderDate!.toISOString(),
        firstOrderRevenue: m.revenue365d,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName
      }));
    
    // 4) Top 5 LTV (Trailing 12 Months = 365d)
    currentStage = 'top-ltv';
    const topLtv = Array.from(customerMetrics.values())
      .filter(m => m.revenue365d > 0)
      .sort((a, b) => b.revenue365d - a.revenue365d)
      .slice(0, 5)
      .map(m => ({ 
        customerId: m.customerId, 
        revenue365d: m.revenue365d, 
        orders365d: m.orders365d, 
        bottles365d: m.bottles365d,
        ltvWindowDays: 365,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName
      }));
    
    // 5) Identify unique customer IDs we need to fetch (union of top lists)
    currentStage = 'collecting-customer-ids';
    const neededCustomerIds = new Set<string>();
    topCustomers90d.forEach(c => neededCustomerIds.add(c.customerId));
    newCustomers30d.forEach(c => neededCustomerIds.add(c.customerId));
    topLtv.forEach(c => neededCustomerIds.add(c.customerId));
    
    console.log(`[Compute] Need customer details for ${neededCustomerIds.size} IDs`);
    
    // 6) Selective customer fetch - only get the ~15 customers we need
    currentStage = 'fetching-customer-details';
    const customerMap = await fetchSelectiveCustomers(neededCustomerIds);
    console.log(`[Compute] Resolved ${customerMap.size}/${neededCustomerIds.size} customer details via selective fetch`);
    
    // 7) Enrich top lists with customer name/email
    // Prefer order.customer data (already captured and included), fallback to /customer endpoint
    currentStage = 'enriching-customer-data';
    const enrichedTopCustomers90d = topCustomers90d.map(c => {
      const metrics = customerMetrics.get(c.customerId);
      const cust = customerMap.get(c.customerId);
      // Prefer data already in c (from customerMetrics), then cust from API
      const email = c.email || metrics?.email || cust?.email || cust?.emailAddress || 'N/A';
      const firstName = c.firstName || metrics?.firstName || cust?.firstName || '';
      const lastName = c.lastName || metrics?.lastName || cust?.lastName || '';
      const name = `${firstName} ${lastName}`.trim() || 'Unknown';
      return { ...c, name, email };
    });
    
    const enrichedNewCustomers30d = newCustomers30d.map(c => {
      const metrics = customerMetrics.get(c.customerId);
      const cust = customerMap.get(c.customerId);
      const email = c.email || metrics?.email || cust?.email || cust?.emailAddress || 'N/A';
      const firstName = c.firstName || metrics?.firstName || cust?.firstName || '';
      const lastName = c.lastName || metrics?.lastName || cust?.lastName || '';
      const name = `${firstName} ${lastName}`.trim() || 'Unknown';
      return { ...c, name, email };
    });
    
    const enrichedTopLtv = topLtv.map(c => {
      const metrics = customerMetrics.get(c.customerId);
      const cust = customerMap.get(c.customerId);
      const email = c.email || metrics?.email || cust?.email || cust?.emailAddress || 'N/A';
      const firstName = c.firstName || metrics?.firstName || cust?.firstName || '';
      const lastName = c.lastName || metrics?.lastName || cust?.lastName || '';
      const name = `${firstName} ${lastName}`.trim() || 'Unknown';
      return { ...c, name, email,
      };
    });
    
    // 8) Instrumentation
    currentStage = 'finalizing';
    const customersWithEmail = Array.from(neededCustomerIds).filter(id => {
      const m = customerMetrics.get(id);
      const c = customerMap.get(id);
      return m?.email || c?.email || c?.emailAddress;
    }).length;
    const customersFromOrders = Array.from(neededCustomerIds).filter(id => customerMetrics.get(id)?.email).length;
    
    const debugCounters = {
      customerIdsInOrders90d: Array.from(customerMetrics.values()).filter(m => m.revenue90d > 0).length,
      customersResolved: customerMap.size,
      customersMissing: neededCustomerIds.size - customerMap.size,
      customersWithEmail,
      customersEnrichedFromOrders: customersFromOrders,
      customerFetchPages: Math.ceil(customerMap.size / 50), // Approximate based on needed IDs
    };
    
    customerAnalytics = {
      topCustomers90d: enrichedTopCustomers90d,
      newCustomers30d: enrichedNewCustomers30d,
      topLtv: enrichedTopLtv,
      debug: debugCounters,
    };
    
    console.log('[Compute] Customer analytics computed successfully:', debugCounters);
  } catch (error) {
    console.error(`[Compute] Error building customer analytics at stage '${currentStage}':`, error);
    console.error('[Compute] Error details:', error.message, error.stack);
    // CRITICAL: Return empty arrays instead of error-only object to prevent UI crashes
    customerAnalytics = { 
      topCustomers90d: [],
      newCustomers30d: [],
      topLtv: [],
      debug: {
        stage: currentStage,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      },
    };
  }

  return {
    overview: {
      revenue: {
        last30Days: parseFloat(revenue30d.toFixed(2)),
        last90Days: parseFloat(revenue90d.toFixed(2)),
        dailyAvg30d: parseFloat((revenue30d / 30).toFixed(2)),
        dailyAvg90d: parseFloat((revenue90d / 90).toFixed(2)),
      },
      orders: { last30Days: orders30d.length, last90Days: orders90d.length },
      inventory: { totalBottles: totalInventory, totalProducts: products.length },
    },
    topMovers,
    monthlyTrend,
    customerAnalytics,
    meta: {
      computedAt: new Date().toISOString(),
      ordersCount: orders.length,
      productsCount: products.length,
      curatedSkuCount: curatedSkus.size,
    },
  };
}

// Audit endpoint for monthly revenue verification
app.get("/backend-api/dash/exec/audit", async (c) => {
  const month = c.req.query("month"); // "2025-11"
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ error: "Provide month=YYYY-MM" }, 400);
  }

  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0)); // next month start

  const orders = await fetchRecentOrdersWithCache(120);
  const products = await fetchAllProductsWithCache();
  const curated = await buildCuratedSkuSet();

  // Map catalog prices (dollars) by sku and build variant ID mapping
  const priceBySku = new Map<string, number>();
  const skuByVariantId = new Map<string, string>();
  for (const p of products) {
    for (const v of (p.variants || [])) {
      const sku = (v.sku || "").trim();
      if (!sku) continue;
      const priceCents = v.price;
      if (typeof priceCents === "number") priceBySku.set(sku, priceCents / 100);
      
      // Map variant ID to SKU
      if (v.id) {
        skuByVariantId.set(String(v.id), sku);
      }
    }
  }

  let orderTotalGross = 0;

  let curatedAllocatedTotal = 0;  // sum of allocated revenue from order totals
  let curatedCatalogTotal = 0;   // sum(qty * catalog_price) curated

  let linesTotal = 0;
  let linesCurated = 0;

  let negQtyLines = 0;
  let missingSkuLines = 0;
  let nonCuratedLines = 0;
  let missingItemTotalLines = 0;

  const sampleLines: any[] = [];

  for (const o of orders) {
    const d = getOrderDate(o);
    if (!d) continue;
    if (d < start || d >= end) continue;

    // gross order total
    const orderTotal = orderTotalDollars(o);
    if (orderTotal > 0) orderTotalGross += orderTotal;

    // Allocate revenue across curated items
    const alloc = allocateCuratedRevenueForOrder(o, curated, skuByVariantId, priceBySku);
    curatedAllocatedTotal += alloc.revenue;

    const items = getLineItems(o);
    for (const it of items) {
      linesTotal++;

      const qty = getQty(it);
      if (qty <= 0) {
        negQtyLines++;
        continue;
      }

      const sku = resolveOrderSku(it, skuByVariantId);
      if (!sku) {
        missingSkuLines++;
        continue;
      }

      if (!curated.has(sku)) {
        nonCuratedLines++;
        continue;
      }

      linesCurated++;

      // Track missing item totals for diagnostics
      const rawLine = it.total ?? it.lineTotal ?? it.extendedPrice ?? null;
      if (typeof rawLine !== "number") {
        missingItemTotalLines++;
      }

      // catalog revenue (for comparison)
      const price = priceBySku.get(sku) ?? 0;
      curatedCatalogTotal += qty * price;

      if (sampleLines.length < 40) {
        sampleLines.push({
          date: d.toISOString(),
          sku,
          qty,
          itemTotal: typeof rawLine === "number" ? centsToDollars(rawLine) : null,
          catalogPrice: price,
          catalogRevenue: qty * price,
          allocatedRevenue: alloc.skuRevenue[sku]?.revenue ?? 0,
          title: it.title || it.productTitle || null,
        });
      }
    }
  }

  return c.json({
    month,
    totals: {
      orderTotalGross: +orderTotalGross.toFixed(2),
      curatedAllocatedTotal: +curatedAllocatedTotal.toFixed(2),
      curatedCatalogTotal: +curatedCatalogTotal.toFixed(2),
    },
    counts: {
      linesTotal,
      linesCurated,
      negQtyLines,
      missingSkuLines,
      nonCuratedLines,
      missingItemTotalLines,
      curatedSkuCount: curated.size,
    },
    sampleLines,
  });
});

// Test endpoint to verify API credentials
app.get("/backend-api/dash/exec/test-apis", async (c) => {
  const results: any = {
    commerce7: { status: "not_tested", error: null, data: null },
  };

  // Test Commerce7
  try {
    const c7ApiKey = Deno.env.get("COMMERCE7_API_KEY");
    const c7TenantId = Deno.env.get("COMMERCE7_TENANT_ID");
    
    if (!c7ApiKey || !c7TenantId) {
      results.commerce7.status = "missing_credentials";
      results.commerce7.error = "COMMERCE7_API_KEY or COMMERCE7_TENANT_ID not set";
    } else {
      results.commerce7.credentials = {
        apiKeyLength: c7ApiKey.length,
        tenantId: c7TenantId,
        apiKeyPrefix: c7ApiKey.substring(0, 8) + "...",
      };

      // Try a simple API call
      const basicAuthCredentials = btoa(`dash:${c7ApiKey}`);
      const response = await fetch("https://api.commerce7.com/v1/product", {
        method: "GET",
        headers: {
          "Authorization": `Basic ${basicAuthCredentials}`,
          "tenant": c7TenantId,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        results.commerce7.status = "success";
        results.commerce7.data = {
          productCount: data?.products?.length ?? 0,
          sampleProduct: data?.products?.[0]?.title ?? null,
        };
      } else {
        results.commerce7.status = "error";
        results.commerce7.error = `HTTP ${response.status}: ${await response.text()}`;
      }
    }
  } catch (error: any) {
    results.commerce7.status = "error";
    results.commerce7.error = error.message;
  }

  return c.json(results);
});


app.get("/backend-api/vintrace/inventory", async (c) => {
  try {
    // Add pagination params - Vintrace defaults to 20, we want more
    const data = await vintraceRequest("/inventory?maxResult=100");
    
    // Vintrace paginated response structure:
    // { firstResult, maxResult, totalResultCount, inventorySummaries: [...] }
    const items = data?.inventorySummaries || data?.results || [];
    
    return c.json({
      success: true,
      totalCount: data?.totalResultCount || items.length,
      rawCount: items.length,
      sampleKeys: items[0] ? Object.keys(items[0]) : [],
      sampleItem: items[0] || null,
      pagination: {
        firstResult: data?.firstResult,
        maxResult: data?.maxResult,
        nextURLPath: data?.nextURLPath,
      },
      data,
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// Cache clear endpoint for debugging
app.post("/backend-api/dash/exec/clear-cache", async (c) => {
  console.log('[Dash/Exec] Clearing all caches...');
  
  // Clear in-memory caches
  ordersCache = null;
  productsCache = null;
  customersCache = null;
  
  // Clear KV cache AND lock
  try {
    await kv.del('dash_exec_cache_v1');
    await kv.del(DASH_LOCK_KEY); // Also clear the lock!
    console.log('[Dash/Exec] KV cache and lock cleared');
  } catch (error) {
    console.error('[Dash/Exec] Error clearing KV cache:', error);
  }
  
  return c.json({ 
    success: true, 
    message: 'All caches and locks cleared. Next request will fetch fresh data.' 
  });
});

// SINGLE CONSOLIDATED ENDPOINT - Figma should ONLY call this
// Clean, deterministic caching: return cache unless ?refresh=1 OR cache >4 hours old
app.get("/backend-api/dash/exec", async (c) => {
  const forceRefresh = c.req.query("refresh") === "1";
  console.log(`[Dash/Exec] Request received ${forceRefresh ? '(FORCE REFRESH)' : ''}`);

  // 1) Read KV cache
  const cached = await readDashCache();

  // 2) Fast path: return cached immediately unless force refresh OR cache >4 hours old
  if (!forceRefresh && cached?.payload) {
    const ageSec = Math.floor((Date.now() - cached.timestamp) / 1000);
    const ageMs = ageSec * 1000;
    const isFresh = ageMs < DASH_CACHE_TTL_MS; // 2 hours
    const isVeryStale = ageMs > 4 * 60 * 60 * 1000; // 4 hours
    
    // Auto-refresh if cache is >4 hours old
    if (isVeryStale) {
      console.log(`[Dash/Exec] ⚠️  Cache is ${ageSec}s old (>4 hours), auto-refreshing...`);
      // Fall through to refresh logic below
    } else {
      console.log(`[Dash/Exec] Returning cached data (age: ${ageSec}s, ${isFresh ? 'fresh' : 'stale but served'})`);
      return c.json({
        ...cached.payload,
        meta: {
          ...cached.payload.meta,
          cacheAge: ageSec,
          cacheStatus: isFresh ? "fresh" : "stale_but_served",
        },
      });
    }
  }

  // 3) Force refresh OR no cache OR very stale: compute fresh (bypassing ALL caches)
  try {
    const isAutoRefresh = cached?.payload && !forceRefresh; // Auto-refresh due to age
    
    // Clear in-memory caches for true fresh refresh
    if (forceRefresh || isAutoRefresh) {
      console.log(`[Dash/Exec] Clearing in-memory caches for ${isAutoRefresh ? 'auto' : 'force'} refresh`);
      ordersCache = null;
      productsCache = null;
      customersCache = null;
    }

    console.log('[Dash/Exec] Computing fresh payload...');
    const freshPayload = await computeDashboardPayload(forceRefresh || isAutoRefresh);

    await writeDashCache(freshPayload);
    console.log('[Dash/Exec] Fresh payload computed and cached');

    return c.json({
      ...freshPayload,
      meta: {
        ...freshPayload.meta,
        cacheAge: 0,
        cacheStatus: isAutoRefresh ? "refreshed_auto" : (forceRefresh ? "refreshed_forced" : "refreshed_no_cache"),
      },
    });
  } catch (error) {
    console.error('[Dash/Exec] Error computing payload:', error);
    
    // If compute fails, fall back to cached if available
    if (cached?.payload) {
      const ageSec = Math.floor((Date.now() - cached.timestamp) / 1000);
      console.log(`[Dash/Exec] Falling back to cached data due to error (age: ${ageSec}s)`);
      return c.json({
        ...cached.payload,
        meta: {
          ...cached.payload.meta,
          cacheAge: ageSec,
          cacheStatus: "error_fallback_to_cache",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
    
    return c.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// ============================================================================
// VINTRACE API EXPLORER - Test/Debug Endpoint
// ============================================================================

app.get("/backend-api/vintrace/search", async (c) => {
  try {
    const type = c.req.query("type") as VintraceSearchType;
    const startsWith = c.req.query("startsWith");
    const exactMatch = c.req.query("exactMatch") === "true";
    const first = c.req.query("first") ? parseInt(c.req.query("first")!) : undefined;

    console.log("[Vintrace Explorer] Request params:", { type, startsWith, exactMatch, first });
    console.log("[Vintrace Explorer] Base URLs - v6:", VintraceAPI.getV6Base(), "v7:", VintraceAPI.getV7Base());

    if (!type) {
      return c.json({ 
        error: "Missing 'type' parameter",
        supportedTypes: [
          "batch", "varietal", "vintage", "owner", "tank", "vessel",
          "grading", "program", "productState", "region", "block",
          "grower", "productCategory", "product", "containerEquipment",
          "barrel", "bin"
        ],
        examples: [
          "/vintrace/search?type=batch&startsWith=BBV",
          "/vintrace/search?type=varietal",
          "/vintrace/search?type=owner",
        ]
      }, 400);
    }

    const results = await VintraceAPI.search({ 
      type, 
      startsWith, 
      exactMatch,
      first 
    });

    return c.json({
      query: { type, startsWith, exactMatch, first },
      count: Array.isArray(results) ? results.length : 0,
      results,
    });
  } catch (error) {
    console.error("[Vintrace Explorer] Error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

app.get("/backend-api/vintrace/batches", async (c) => {
  try {
    const batches = await VintraceAPI.getBlackbirdBatches();
    
    // Parse batch codes
    const parsed = batches.map((batch: any) => ({
      ...batch,
      parsed: VintraceAPI.parseBlackbirdBatchCode(batch.code || batch.name || ""),
    }));

    return c.json({
      count: parsed.length,
      batches: parsed,
    });
  } catch (error) {
    console.error("[Vintrace Batches] Error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

app.get("/backend-api/vintrace/inventory", async (c) => {
  try {
    const bbvOnly = c.req.query("bbvOnly") === "true";
    
    const inventory = bbvOnly 
      ? await VintraceAPI.getBlackbirdInventory()
      : await VintraceAPI.getInventory();

    return c.json({
      count: inventory.length,
      bbvOnly,
      inventory,
    });
  } catch (error) {
    console.error("[Vintrace Inventory] Error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

app.get("/backend-api/vintrace/wine-batches", async (c) => {
  try {
    const bbvOnly = c.req.query("bbvOnly") === "true";
    const offset = parseInt(c.req.query("offset") || "0", 10);
    const limit = parseInt(c.req.query("limit") || "100", 10);
    
    if (bbvOnly) {
      // Get vessel details which includes batch info, volume, cost, and composition
      // This is filtered for owner ID 3 (Blackbird Vineyards)
      const vessels = await VintraceAPI.getAllBlackbirdVesselDetails();
      
      console.log(`[Vintrace] Total vessels fetched: ${vessels.length}`);
      
      // Log sample vessel to understand structure
      if (vessels.length > 0) {
        console.log(`[Vintrace] Sample vessel:`, JSON.stringify(vessels[0], null, 2));
      }
      
      // Filter for 2024 and 2025 vintages and group by batch
      const batchMap = new Map<string, any>();
      
      vessels.forEach((vessel: any) => {
        const batchCode = vessel.wineBatch?.name;
        const vintage = vessel.wineBatch?.vintage;
        
        if (!batchCode || !vintage) return;
        
        // Filter for 2024 and 2025 vintages
        if (vintage !== "2024" && vintage !== "2025") return;
        
        // Group vessels by batch code
        if (!batchMap.has(batchCode)) {
          batchMap.set(batchCode, {
            batchCode: batchCode,
            id: vessel.wineBatch?.id,
            description: vessel.wineBatch?.description,
            vintage: vessel.wineBatch?.vintage,
            designatedRegion: vessel.wineBatch?.designatedRegion,
            designatedSubRegion: vessel.wineBatch?.designatedSubRegion,
            designatedVariety: vessel.wineBatch?.designatedVariety,
            program: vessel.wineBatch?.program,
            productCategory: vessel.wineBatch?.productCategory,
            grading: vessel.wineBatch?.grading,
            owner: vessel.owner, // Include owner info for display
            productionYear: parseInt(vessel.wineBatch?.vintage || '0'), // Add productionYear as number
            currentVolume: 0,
            volumeUnit: vessel.volume?.unit || 'gal',
            totalCost: {
              total: 0,
              fruit: 0,
              overhead: 0,
              storage: 0,
              additive: 0,
              bulk: 0,
              packaging: 0,
              operation: 0,
              freight: 0,
              other: 0
            },
            vessels: [],
            parsed: VintraceAPI.parseBlackbirdBatchCode(batchCode),
          });
        }
        
        const batch = batchMap.get(batchCode)!;
        
        // Add vessel volume
        batch.currentVolume += vessel.volume?.value || 0;
        
        // Add vessel costs
        if (vessel.cost) {
          batch.totalCost.total += vessel.cost.total || 0;
          batch.totalCost.fruit += vessel.cost.fruit || 0;
          batch.totalCost.overhead += vessel.cost.overhead || 0;
          batch.totalCost.storage += vessel.cost.storage || 0;
          batch.totalCost.additive += vessel.cost.additive || 0;
          batch.totalCost.bulk += vessel.cost.bulk || 0;
          batch.totalCost.packaging += vessel.cost.packaging || 0;
          batch.totalCost.operation += vessel.cost.operation || 0;
          batch.totalCost.freight += vessel.cost.freight || 0;
          batch.totalCost.other += vessel.cost.other || 0;
        }
        
        // Store vessel info including composition, allocations, and live metrics
        batch.vessels.push({
          id: vessel.id,
          name: vessel.name,
          vesselType: vessel.vesselType,
          volume: vessel.volume,
          capacity: vessel.capacity,
          ullage: vessel.ullage,
          productState: vessel.productState,
          composition: vessel.composition,
          allocations: vessel.allocations,
          liveMetrics: vessel.liveMetrics,
          ttbDetails: vessel.ttbDetails,
          cost: vessel.cost,
        });
      });
      
      // Convert map to array and filter out batches with no volume
      const bbvBatches = Array.from(batchMap.values())
        .filter((batch: any) => batch.currentVolume > 0);
      
      console.log(`[Vintrace] Blackbird batches for 2024/2025 vintages with volume > 0: ${bbvBatches.length}`);
      if (bbvBatches.length > 0) {
        console.log(`[Vintrace] Sample batch:`, {
          batchCode: bbvBatches[0].batchCode,
          vintage: bbvBatches[0].vintage,
          currentVolume: bbvBatches[0].currentVolume,
          volumeUnit: bbvBatches[0].volumeUnit,
          vessels: bbvBatches[0].vessels.length,
        });
      }
      
      return c.json({
        totalResults: bbvBatches.length,
        count: bbvBatches.length,
        bbvOnly: true,
        vintages: [2024, 2025],
        batches: bbvBatches,
      });
    } else {
      // Get paginated results
      const response = await VintraceAPI.getWineBatches(undefined, offset, limit);
      return c.json(response);
    }
  } catch (error) {
    console.error("[Vintrace Wine Batches] Error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

// New endpoint to debug vessel details directly
app.get("/backend-api/vintrace/vessel-details", async (c) => {
  try {
    console.log("[Vintrace Vessel Details] Fetching vessel details for Blackbird (owner 3)...");
    
    // Get vessel details for Blackbird (owner ID 3)
    const vessels = await VintraceAPI.getAllBlackbirdVesselDetails();
    
    console.log(`[Vintrace Vessel Details] Found ${vessels.length} vessels`);
    
    // Log sample vessel for debugging
    if (vessels.length > 0) {
      console.log("[Vintrace Vessel Details] Sample vessel:", JSON.stringify(vessels[0], null, 2));
    }
    
    return c.json({
      totalResults: vessels.length,
      count: vessels.length,
      vessels: vessels,
    });
  } catch (error) {
    console.error("[Vintrace Vessel Details] Error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

app.get("/backend-api/vintrace/debug", async (c) => {
  try {
    const endpoint = c.req.query("endpoint") || "/stock/dispatches";
    const paramsStr = c.req.query("params");
    const apiVersion = c.req.query("apiVersion") || "v7";
    
    console.log(`[Vintrace Debug] Testing endpoint: ${endpoint}`);
    console.log(`[Vintrace Debug] API Version: ${apiVersion}`);
    console.log(`[Vintrace Debug] Params string: ${paramsStr}`);
    
    // Parse params if provided
    let params = {};
    if (paramsStr) {
      try {
        params = JSON.parse(paramsStr);
      } catch (e) {
        console.error(`[Vintrace Debug] Failed to parse params:`, e);
      }
    }
    
    console.log(`[Vintrace Debug] Parsed params:`, params);
    
    // Build full URL
    const VINTRACE_BASE = Deno.env.get("VINTRACE_BASE_URL") || "https://us30.vintrace.net/bla";
    const baseUrl = VINTRACE_BASE.endsWith('/') ? VINTRACE_BASE.slice(0, -1) : VINTRACE_BASE;
    const cleanBase = baseUrl.replace(/\/api.*$/, '');
    const fullUrl = `${cleanBase}/api/${apiVersion}${endpoint}`;
    
    console.log(`[Vintrace Debug] VINTRACE_BASE: ${VINTRACE_BASE}`);
    console.log(`[Vintrace Debug] baseUrl: ${baseUrl}`);
    console.log(`[Vintrace Debug] cleanBase: ${cleanBase}`);
    console.log(`[Vintrace Debug] endpoint: ${endpoint}`);
    console.log(`[Vintrace Debug] fullUrl (before params): ${fullUrl}`);
    
    // Build query string
    const queryString = Object.keys(params).length > 0 
      ? "?" + new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    
    const finalUrl = fullUrl + queryString;
    
    console.log(`[Vintrace Debug] Full URL: ${finalUrl}`);
    
    // Make request
    const VINTRACE_API_KEY = Deno.env.get("VINTRACE_API_KEY");
    const response = await fetch(finalUrl, {
      method: "GET",
      headers: {
        "correlation-id": "",
        "Accept": "application/json",
        "Authorization": `Bearer ${VINTRACE_API_KEY}`,
      },
    });
    
    console.log(`[Vintrace Debug] Response status: ${response.status}`);
    
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    
    console.log(`[Vintrace Debug] Content-Type: ${contentType}`);
    console.log(`[Vintrace Debug] Response (first 500 chars): ${text.substring(0, 500)}`);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    
    return c.json({
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: contentType,
      url: finalUrl,
      endpoint: endpoint,
      params: params,
      raw: data,
      // Debug info
      debug: {
        VINTRACE_BASE,
        baseUrl,
        cleanBase,
        fullUrl,
        queryString,
        bodyPreview: typeof data === 'string' ? data.substring(0, 500) : undefined,
        bodyLength: typeof data === 'string' ? data.length : undefined,
      }
    });
  } catch (error) {
    console.error("[Vintrace Debug] Error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

app.get("/backend-api/vintrace/stock-dispatches", async (c) => {
  try {
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const year = c.req.query("year"); // Convenience parameter for "year 2025"
    
    console.log(`[Vintrace Stock Dispatches] Fetching dispatches for Blackbird (owner 3)...`);
    console.log(`[Vintrace Stock Dispatches] Filters: startDate=${startDate}, endDate=${endDate}, year=${year}`);
    
    // If year is provided, set startDate and endDate to cover the whole year
    let finalStartDate = startDate;
    let finalEndDate = endDate;
    
    if (year) {
      finalStartDate = `${year}-01-01`;
      finalEndDate = `${year}-12-31`;
      console.log(`[Vintrace Stock Dispatches] Using year ${year}: ${finalStartDate} to ${finalEndDate}`);
    }
    
    // Get all dispatches for Blackbird (owner ID 3)
    const dispatches = await VintraceAPI.getAllBlackbirdDispatches(finalStartDate, finalEndDate);
    
    console.log(`[Vintrace Stock Dispatches] Found ${dispatches.length} dispatches`);
    
    // Log sample dispatch for debugging
    if (dispatches.length > 0) {
      console.log("[Vintrace Stock Dispatches] Sample dispatch:", JSON.stringify(dispatches[0], null, 2));
    }
    
    // Group dispatch types for analysis
    const dispatchTypes = dispatches.reduce((acc: Record<string, number>, dispatch: any) => {
      const type = dispatch.dispatchType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    console.log("[Vintrace Stock Dispatches] Dispatch types:", dispatchTypes);
    
    return c.json({
      totalResults: dispatches.length,
      count: dispatches.length,
      dispatches: dispatches,
      dispatchTypes: dispatchTypes,
    });
  } catch (error) {
    console.error("[Vintrace Stock Dispatches] Error:", error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 500);
  }
});

Deno.serve(app.fetch);
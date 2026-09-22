/**
 * Cloudflare Worker API for Enerjoo Solar Platform
 * Powered by Cloudflare Workers & Cloudflare D1
 *
 * Current Live URL: https://enerjoo-api.enerjoo320.workers.dev
 * Database Binding: env.DB
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; meta?: any; results?: T[] }>;
  all<T = unknown>(): Promise<{ success: boolean; results: T[]; meta?: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<{ success: boolean; results?: T[] }>>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface Env {
  DB: D1Database;
}

// ============================================================================
// CORS Configuration
// ============================================================================
const getCorsHeaders = (request: Request): HeadersInit => {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = [
    'https://enerjoo.com',
    'https://www.enerjoo.com',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  const isAllowed =
    allowedOrigins.includes(origin) ||
    origin.endsWith('.run.app') ||
    origin.endsWith('.enerjoo.com');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://enerjoo.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
};

// ============================================================================
// Response Helpers
// ============================================================================
function json(data: unknown, status = 200, request?: Request): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (request) {
    Object.assign(headers, getCorsHeaders(request));
  } else {
    headers['Access-Control-Allow-Origin'] = 'https://enerjoo.com';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
  }

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

function errorJson(message: string, status = 400, request?: Request): Response {
  return json({ success: false, error: message }, status, request);
}

function successJson(data: Record<string, unknown>, status = 200, request?: Request): Response {
  return json({ success: true, ...data }, status, request);
}

// Generate simple UUID fallback for D1 record keys
function generateId(prefix?: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return prefix ? `${prefix}_${time}${rand}` : `${time}-${rand}`;
}

// ============================================================================
// Main Worker Fetch Handler
// ============================================================================
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, ''); // Remove trailing slash
    const method = request.method.toUpperCase();

    // Check DB binding
    if (!env.DB) {
      return errorJson('Database connection (DB binding) not configured', 500, request);
    }

    try {
      // ----------------------------------------------------------------------
      // Root Health Endpoint (Preserved exactly)
      // ----------------------------------------------------------------------
      if (path === '' || path === '/') {
        return successJson(
          {
            service: 'Enerjoo API',
            database: 'D1',
            status: 'connected',
          },
          200,
          request
        );
      }

      // ----------------------------------------------------------------------
      // /products (Preserved existing endpoint)
      // ----------------------------------------------------------------------
      if (path === '/products' || path.startsWith('/products/')) {
        return await handleProducts(request, env, path, method);
      }

      // ----------------------------------------------------------------------
      // /customers (Preserved existing endpoint)
      // ----------------------------------------------------------------------
      if (path === '/customers' || path.startsWith('/customers/')) {
        return await handleCustomers(request, env, path, method);
      }

      // ----------------------------------------------------------------------
      // /users (New Table)
      // ----------------------------------------------------------------------
      if (path === '/users' || path.startsWith('/users/')) {
        return await handleUsers(request, env, path, method);
      }

      // ----------------------------------------------------------------------
      // /suppliers (New Table)
      // ----------------------------------------------------------------------
      if (path === '/suppliers' || path.startsWith('/suppliers/')) {
        return await handleSuppliers(request, env, path, method);
      }

      // ----------------------------------------------------------------------
      // /solar-requests (New Table)
      // ----------------------------------------------------------------------
      if (path === '/solar-requests' || path.startsWith('/solar-requests/')) {
        return await handleSolarRequests(request, env, path, method);
      }

      // ----------------------------------------------------------------------
      // /quotations (New Table)
      // ----------------------------------------------------------------------
      if (path === '/quotations' || path.startsWith('/quotations/')) {
        return await handleQuotations(request, env, path, method);
      }

      // ----------------------------------------------------------------------
      // /quotation-items (New Table)
      // ----------------------------------------------------------------------
      if (path === '/quotation-items' || path.startsWith('/quotation-items/')) {
        return await handleQuotationItems(request, env, path, method);
      }

      // ----------------------------------------------------------------------
      // /reviews (New Table: product_reviews)
      // ----------------------------------------------------------------------
      if (path === '/reviews' || path.startsWith('/reviews/')) {
        return await handleProductReviews(request, env, path, method);
      }

      // Endpoint Not Found
      return errorJson('Endpoint not found', 404, request);
    } catch (err: any) {
      console.error('Unhandled Worker Error:', err);
      return errorJson(err?.message || 'Internal Server Error', 500, request);
    }
  },
};

// ============================================================================
// 1. /products Handler (Preserved Existing Implementation)
// ============================================================================
async function handleProducts(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const productId = parts[1]; // /products/:id

  if (method === 'GET') {
    if (productId) {
      const row = await env.DB.prepare('SELECT * FROM products WHERE product_id = ?')
        .bind(productId)
        .first();
      if (!row) return errorJson(`Product not found: ${productId}`, 404, request);
      return successJson({ product: row }, 200, request);
    }

    const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC LIMIT 500').all();
    return successJson({ count: results.length, products: results }, 200, request);
  }

  if (method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    if (!body.product_id || !body.brand || !body.model) {
      return errorJson('Missing required fields: product_id, brand, model', 400, request);
    }

    // Check conflict
    const existing = await env.DB.prepare('SELECT product_id FROM products WHERE product_id = ?')
      .bind(body.product_id)
      .first();
    if (existing) {
      return errorJson(`Product with ID '${body.product_id}' already exists`, 409, request);
    }

    const query = `
      INSERT INTO products (
        product_id, product_category, brand, model, product_type, technology,
        cell_type, number_of_cells, power_w, rated_power_kw, surge_power_w,
        waveform, ac_voltage_v, ac_voltage_regulation, frequency_hz, peak_efficiency_percent,
        transfer_time_ms, battery_voltage_v, nominal_voltage_v, capacity_ah, nominal_energy_wh,
        max_output_power_kw, recommended_charge_voltage_v, recommended_charge_current_a,
        end_of_discharge_voltage_v, max_continuous_charge_current_a, max_continuous_discharge_current_a,
        cycle_life, communication, max_pv_open_circuit_voltage_v, max_pv_array_power_w,
        max_pv_input_current_a, pv_mppt_voltage_range_v, max_solar_charger_current_a,
        max_ac_charger_current_a, max_charge_current_a, vmp_v, voc_v, imp_a, isc_a,
        efficiency_percent, temperature_coefficient_pmax, temperature_coefficient_voc,
        temperature_coefficient_isc, max_system_voltage_v, maximum_series_fuse_a,
        dimensions_mm, machine_dimensions_w_h_d_mm, weight_kg, nw_kg, gw_kg,
        front_glass, back_glass, frame, connector_type, junction_box,
        operating_temperature, storage_temperature, warranty_years, price_egp,
        supplier, availability, image_url, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, datetime('now'), datetime('now')
      )
    `;

    await env.DB.prepare(query)
      .bind(
        body.product_id,
        body.product_category || 'Solar Panels',
        body.brand,
        body.model,
        body.product_type || null,
        body.technology || null,
        body.cell_type || null,
        body.number_of_cells || null,
        body.power_w || null,
        body.rated_power_kw || null,
        body.surge_power_w || null,
        body.waveform || null,
        body.ac_voltage_v || null,
        body.ac_voltage_regulation || null,
        body.frequency_hz || null,
        body.peak_efficiency_percent || null,
        body.transfer_time_ms || null,
        body.battery_voltage_v || null,
        body.nominal_voltage_v || null,
        body.capacity_ah || null,
        body.nominal_energy_wh || null,
        body.max_output_power_kw || null,
        body.recommended_charge_voltage_v || null,
        body.recommended_charge_current_a || null,
        body.end_of_discharge_voltage_v || null,
        body.max_continuous_charge_current_a || null,
        body.max_continuous_discharge_current_a || null,
        body.cycle_life || null,
        body.communication || null,
        body.max_pv_open_circuit_voltage_v || null,
        body.max_pv_array_power_w || null,
        body.max_pv_input_current_a || null,
        body.pv_mppt_voltage_range_v || null,
        body.max_solar_charger_current_a || null,
        body.max_ac_charger_current_a || null,
        body.max_charge_current_a || null,
        body.vmp_v || null,
        body.voc_v || null,
        body.imp_a || null,
        body.isc_a || null,
        body.efficiency_percent || null,
        body.temperature_coefficient_pmax || null,
        body.temperature_coefficient_voc || null,
        body.temperature_coefficient_isc || null,
        body.max_system_voltage_v || null,
        body.maximum_series_fuse_a || null,
        body.dimensions_mm || null,
        body.machine_dimensions_w_h_d_mm || null,
        body.weight_kg || null,
        body.nw_kg || null,
        body.gw_kg || null,
        body.front_glass || null,
        body.back_glass || null,
        body.frame || null,
        body.connector_type || null,
        body.junction_box || null,
        body.operating_temperature || null,
        body.storage_temperature || null,
        body.warranty_years || null,
        body.price_egp || 0,
        body.supplier || null,
        body.availability || 'Available',
        body.image_url || null,
        body.notes || null
      )
      .run();

    return successJson({ message: 'Product created successfully', product_id: body.product_id }, 201, request);
  }

  if (method === 'PUT') {
    if (!productId) return errorJson('Product ID required in path', 400, request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const existing = await env.DB.prepare('SELECT product_id FROM products WHERE product_id = ?')
      .bind(productId)
      .first();
    if (!existing) return errorJson(`Product not found: ${productId}`, 404, request);

    await env.DB.prepare(
      `UPDATE products SET 
        brand = COALESCE(?, brand),
        model = COALESCE(?, model),
        power_w = COALESCE(?, power_w),
        price_egp = COALESCE(?, price_egp),
        image_url = COALESCE(?, image_url),
        availability = COALESCE(?, availability),
        updated_at = datetime('now')
      WHERE product_id = ?`
    )
      .bind(body.brand || null, body.model || null, body.power_w || null, body.price_egp || null, body.image_url || null, body.availability || null, productId)
      .run();

    return successJson({ message: 'Product updated successfully', product_id: productId }, 200, request);
  }

  if (method === 'DELETE') {
    if (!productId) return errorJson('Product ID required in path', 400, request);

    const existing = await env.DB.prepare('SELECT product_id FROM products WHERE product_id = ?')
      .bind(productId)
      .first();
    if (!existing) return errorJson(`Product not found: ${productId}`, 404, request);

    await env.DB.prepare('DELETE FROM products WHERE product_id = ?').bind(productId).run();
    return successJson({ message: 'Product deleted successfully', product_id: productId }, 200, request);
  }

  return errorJson(`Method ${method} not allowed for /products`, 405, request);
}

// ============================================================================
// 2. /customers Handler (Preserved Existing Implementation)
// ============================================================================
async function handleCustomers(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const customerId = parts[1]; // /customers/:id

  if (method === 'GET') {
    if (customerId) {
      const row = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(customerId).first();
      if (!row) return errorJson(`Customer not found: ${customerId}`, 404, request);
      return successJson({ customer: row }, 200, request);
    }

    const { results } = await env.DB.prepare('SELECT * FROM customers ORDER BY created_at DESC LIMIT 500').all();
    return successJson({ count: results.length, customers: results }, 200, request);
  }

  if (method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    if (!body.phone_number) {
      return errorJson('Missing required field: phone_number', 400, request);
    }

    const id = body.id || body.uid || generateId('cust');
    const fullName = body.full_name || body.fullName || 'عميل إينرجو';
    const phoneNumber = body.phone_number || body.phoneNumber;
    const normalizedPhone = body.normalized_phone_number || body.normalizedPhoneNumber || phoneNumber.replace(/[^0-9]/g, '');
    const email = body.email || null;
    const governorate = body.governorate || 'القاهرة';
    const authProvider = body.auth_provider || body.authProvider || 'phone';
    const legacyId = body.legacy_customer_id || body.legacyCustomerId || null;
    const userId = body.user_id || body.userId || null;

    // Check if exists
    const existing = await env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(id).first();
    if (existing) {
      // Update instead of failing
      await env.DB.prepare(
        `UPDATE customers SET 
          full_name = ?, phone_number = ?, normalized_phone_number = ?,
          email = ?, governorate = ?, auth_provider = ?, last_login_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?`
      )
        .bind(fullName, phoneNumber, normalizedPhone, email, governorate, authProvider, id)
        .run();

      return successJson({ message: 'Customer updated successfully', customer_id: id }, 200, request);
    }

    await env.DB.prepare(
      `INSERT INTO customers (
        id, user_id, full_name, phone_number, normalized_phone_number,
        email, governorate, auth_provider, legacy_customer_id, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`
    )
      .bind(id, userId, fullName, phoneNumber, normalizedPhone, email, governorate, authProvider, legacyId)
      .run();

    return successJson({ message: 'Customer created successfully', customer_id: id }, 201, request);
  }

  if (method === 'PUT') {
    if (!customerId) return errorJson('Customer ID required in path', 400, request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const existing = await env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(customerId).first();
    if (!existing) return errorJson(`Customer not found: ${customerId}`, 404, request);

    await env.DB.prepare(
      `UPDATE customers SET
        full_name = COALESCE(?, full_name),
        phone_number = COALESCE(?, phone_number),
        normalized_phone_number = COALESCE(?, normalized_phone_number),
        email = COALESCE(?, email),
        governorate = COALESCE(?, governorate),
        updated_at = datetime('now')
      WHERE id = ?`
    )
      .bind(
        body.full_name || body.fullName || null,
        body.phone_number || body.phoneNumber || null,
        body.normalized_phone_number || body.normalizedPhoneNumber || null,
        body.email || null,
        body.governorate || null,
        customerId
      )
      .run();

    return successJson({ message: 'Customer updated successfully', customer_id: customerId }, 200, request);
  }

  if (method === 'DELETE') {
    if (!customerId) return errorJson('Customer ID required in path', 400, request);

    const existing = await env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(customerId).first();
    if (!existing) return errorJson(`Customer not found: ${customerId}`, 404, request);

    await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(customerId).run();
    return successJson({ message: 'Customer deleted successfully', customer_id: customerId }, 200, request);
  }

  return errorJson(`Method ${method} not allowed for /customers`, 405, request);
}

// ============================================================================
// 3. /users Handler (New Table)
// ============================================================================
async function handleUsers(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const userId = parts[1]; // /users/:id
  const url = new URL(request.url);

  if (method === 'GET') {
    if (userId) {
      const user = await env.DB.prepare(
        'SELECT id, email, name, name_ar, type, company, phone, governorate, location, avatar, profile_image, verified, rejected, created_at, updated_at FROM users WHERE id = ?'
      )
        .bind(userId)
        .first();
      if (!user) return errorJson(`User not found: ${userId}`, 404, request);
      return successJson({ user }, 200, request);
    }

    const typeFilter = url.searchParams.get('type');
    const verifiedFilter = url.searchParams.get('verified');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

    let query = 'SELECT id, email, name, name_ar, type, company, phone, governorate, location, avatar, profile_image, verified, rejected, created_at, updated_at FROM users WHERE 1=1';
    const params: any[] = [];

    if (typeFilter) {
      query += ' AND type = ?';
      params.push(typeFilter);
    }
    if (verifiedFilter !== null) {
      query += ' AND verified = ?';
      params.push(verifiedFilter === 'true' || verifiedFilter === '1' ? 1 : 0);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = env.DB.prepare(query);
    const { results } = await stmt.bind(...params).all();
    return successJson({ count: results.length, users: results }, 200, request);
  }

  if (method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    if (!body.name) {
      return errorJson("Missing required field: 'name'", 400, request);
    }

    const type = body.type || 'customer';
    if (!['customer', 'supplier', 'admin'].includes(type)) {
      return errorJson("Invalid 'type'. Must be 'customer', 'supplier', or 'admin'", 400, request);
    }

    const id = body.id || body.uid || generateId('usr');
    const email = body.email ? body.email.toLowerCase().trim() : null;

    // Check conflict for ID or Email
    if (email) {
      const emailConflict = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
        .bind(email, id)
        .first();
      if (emailConflict) {
        return errorJson(`A user with email '${email}' already exists`, 409, request);
      }
    }

    const existingUser = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (existingUser) {
      return errorJson(`User with ID '${id}' already exists`, 409, request);
    }

    await env.DB.prepare(
      `INSERT INTO users (
        id, email, password_hash, name, name_ar, type, company, phone,
        governorate, location, avatar, profile_image, verified, rejected,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )`
    )
      .bind(
        id,
        email,
        body.password_hash || null,
        body.name,
        body.name_ar || body.nameAr || null,
        type,
        body.company || null,
        body.phone || null,
        body.governorate || 'القاهرة',
        body.location || 'Cairo, Egypt',
        body.avatar || null,
        body.profile_image || body.profileImage || null,
        body.verified ? 1 : 0,
        body.rejected ? 1 : 0
      )
      .run();

    return successJson({ message: 'User created successfully', user_id: id }, 201, request);
  }

  if (method === 'PUT') {
    if (!userId) return errorJson('User ID required in path', 400, request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
    if (!existing) return errorJson(`User not found: ${userId}`, 404, request);

    // Email unique check if updated
    if (body.email) {
      const email = body.email.toLowerCase().trim();
      const conflict = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
        .bind(email, userId)
        .first();
      if (conflict) {
        return errorJson(`Email '${email}' is already in use by another account`, 409, request);
      }
    }

    await env.DB.prepare(
      `UPDATE users SET
        name = COALESCE(?, name),
        name_ar = COALESCE(?, name_ar),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        company = COALESCE(?, company),
        governorate = COALESCE(?, governorate),
        location = COALESCE(?, location),
        avatar = COALESCE(?, avatar),
        profile_image = COALESCE(?, profile_image),
        verified = CASE WHEN ? IS NOT NULL THEN ? ELSE verified END,
        rejected = CASE WHEN ? IS NOT NULL THEN ? ELSE rejected END,
        updated_at = datetime('now')
      WHERE id = ?`
    )
      .bind(
        body.name || null,
        body.name_ar || body.nameAr || null,
        body.email ? body.email.toLowerCase().trim() : null,
        body.phone || null,
        body.company || null,
        body.governorate || null,
        body.location || null,
        body.avatar || null,
        body.profile_image || body.profileImage || null,
        body.verified !== undefined ? 1 : null,
        body.verified ? 1 : 0,
        body.rejected !== undefined ? 1 : null,
        body.rejected ? 1 : 0,
        userId
      )
      .run();

    return successJson({ message: 'User updated successfully', user_id: userId }, 200, request);
  }

  if (method === 'DELETE') {
    if (!userId) return errorJson('User ID required in path', 400, request);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
    if (!existing) return errorJson(`User not found: ${userId}`, 404, request);

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
    return successJson({ message: 'User deleted successfully', user_id: userId }, 200, request);
  }

  return errorJson(`Method ${method} not allowed for /users`, 405, request);
}

// ============================================================================
// 4. /suppliers Handler (New Table)
// ============================================================================
async function handleSuppliers(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const supplierId = parts[1]; // /suppliers/:id
  const url = new URL(request.url);

  if (method === 'GET') {
    if (supplierId) {
      const supplier = await env.DB.prepare('SELECT * FROM suppliers WHERE id = ?').bind(supplierId).first();
      if (!supplier) return errorJson(`Supplier not found: ${supplierId}`, 404, request);
      return successJson({ supplier }, 200, request);
    }

    const verifiedOnly = url.searchParams.get('verified');
    const location = url.searchParams.get('location');

    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params: any[] = [];

    if (verifiedOnly !== null) {
      query += ' AND verified = ?';
      params.push(verifiedOnly === 'true' || verifiedOnly === '1' ? 1 : 0);
    }
    if (location) {
      query += ' AND location LIKE ?';
      params.push(`%${location}%`);
    }
    query += ' ORDER BY verified DESC, rating DESC, total_sales DESC';

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return successJson({ count: results.length, suppliers: results }, 200, request);
  }

  if (method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    if (!body.name || !body.phone || !body.location) {
      return errorJson("Missing required fields: 'name', 'phone', and 'location'", 400, request);
    }

    const id = body.id || generateId('sup');

    const existing = await env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(id).first();
    if (existing) {
      return errorJson(`Supplier with ID '${id}' already exists`, 409, request);
    }

    await env.DB.prepare(
      `INSERT INTO suppliers (
        id, user_id, name, name_ar, phone, email, location, price,
        rating, total_sales, verified, rejected, avatar, profile_image,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )`
    )
      .bind(
        id,
        body.user_id || body.userId || null,
        body.name,
        body.name_ar || body.nameAr || null,
        body.phone,
        body.email || null,
        body.location,
        typeof body.price === 'number' ? body.price : 0.0,
        typeof body.rating === 'number' ? body.rating : 0.0,
        typeof body.total_sales === 'number' ? body.total_sales : (body.totalSales || 0),
        body.verified ? 1 : 0,
        body.rejected ? 1 : 0,
        body.avatar || null,
        body.profile_image || body.profileImage || null
      )
      .run();

    return successJson({ message: 'Supplier created successfully', supplier_id: id }, 201, request);
  }

  if (method === 'PUT') {
    if (!supplierId) return errorJson('Supplier ID required in path', 400, request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const existing = await env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(supplierId).first();
    if (!existing) return errorJson(`Supplier not found: ${supplierId}`, 404, request);

    await env.DB.prepare(
      `UPDATE suppliers SET
        name = COALESCE(?, name),
        name_ar = COALESCE(?, name_ar),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        location = COALESCE(?, location),
        price = COALESCE(?, price),
        rating = COALESCE(?, rating),
        total_sales = COALESCE(?, total_sales),
        verified = CASE WHEN ? IS NOT NULL THEN ? ELSE verified END,
        rejected = CASE WHEN ? IS NOT NULL THEN ? ELSE rejected END,
        avatar = COALESCE(?, avatar),
        profile_image = COALESCE(?, profile_image),
        updated_at = datetime('now')
      WHERE id = ?`
    )
      .bind(
        body.name || null,
        body.name_ar || body.nameAr || null,
        body.phone || null,
        body.email || null,
        body.location || null,
        typeof body.price === 'number' ? body.price : null,
        typeof body.rating === 'number' ? body.rating : null,
        typeof body.total_sales === 'number' ? body.total_sales : (body.totalSales !== undefined ? body.totalSales : null),
        body.verified !== undefined ? 1 : null,
        body.verified ? 1 : 0,
        body.rejected !== undefined ? 1 : null,
        body.rejected ? 1 : 0,
        body.avatar || null,
        body.profile_image || body.profileImage || null,
        supplierId
      )
      .run();

    return successJson({ message: 'Supplier updated successfully', supplier_id: supplierId }, 200, request);
  }

  if (method === 'DELETE') {
    if (!supplierId) return errorJson('Supplier ID required in path', 400, request);

    const existing = await env.DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(supplierId).first();
    if (!existing) return errorJson(`Supplier not found: ${supplierId}`, 404, request);

    await env.DB.prepare('DELETE FROM suppliers WHERE id = ?').bind(supplierId).run();
    return successJson({ message: 'Supplier deleted successfully', supplier_id: supplierId }, 200, request);
  }

  return errorJson(`Method ${method} not allowed for /suppliers`, 405, request);
}

// ============================================================================
// 5. /solar-requests Handler (New Table)
// ============================================================================
async function handleSolarRequests(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const reqIdentifier = parts[1]; // id or request_id
  const url = new URL(request.url);

  if (method === 'GET') {
    if (reqIdentifier) {
      const row = await env.DB.prepare(
        'SELECT * FROM solar_requests WHERE id = ? OR request_id = ?'
      )
        .bind(reqIdentifier, reqIdentifier)
        .first();
      if (!row) return errorJson(`Solar request not found: ${reqIdentifier}`, 404, request);
      return successJson({ solar_request: row }, 200, request);
    }

    const customerId = url.searchParams.get('customer_id') || url.searchParams.get('customerId');
    const customerPhone = url.searchParams.get('customer_phone') || url.searchParams.get('phone');
    const status = url.searchParams.get('status');
    const systemType = url.searchParams.get('system_type');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

    let query = 'SELECT * FROM solar_requests WHERE 1=1';
    const params: any[] = [];

    if (customerId) {
      query += ' AND customer_id = ?';
      params.push(customerId);
    }
    if (customerPhone) {
      query += ' AND customer_phone = ?';
      params.push(customerPhone);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (systemType) {
      query += ' AND system_type = ?';
      params.push(systemType);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return successJson({ count: results.length, solar_requests: results }, 200, request);
  }

  if (method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    if (!body.customer_name && !body.customerName) {
      return errorJson("Missing required field: 'customer_name'", 400, request);
    }
    if (!body.customer_phone && !body.customerPhone) {
      return errorJson("Missing required field: 'customer_phone'", 400, request);
    }

    const systemType = body.system_type || body.systemType || 'hybrid';
    const validSystemTypes = ['on-grid', 'off-grid', 'hybrid', 'pump'];
    if (!validSystemTypes.includes(systemType)) {
      return errorJson(`Invalid 'system_type'. Allowed: ${validSystemTypes.join(', ')}`, 400, request);
    }

    const tier = body.tier || 'recommended';
    const validTiers = ['budget', 'recommended', 'premium'];
    if (!validTiers.includes(tier)) {
      return errorJson(`Invalid 'tier'. Allowed: ${validTiers.join(', ')}`, 400, request);
    }

    const id = body.id || generateId('req');
    const requestId = body.request_id || body.requestId || `ENJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Check conflict
    const existing = await env.DB.prepare('SELECT id FROM solar_requests WHERE request_id = ?')
      .bind(requestId)
      .first();
    if (existing) {
      return errorJson(`Solar request with request_id '${requestId}' already exists`, 409, request);
    }

    const inputsJson = typeof body.inputs === 'object' ? JSON.stringify(body.inputs) : (body.inputs_json || '{}');
    const outputsJson = typeof body.calculatedOutputs === 'object' ? JSON.stringify(body.calculatedOutputs) : (body.calculated_outputs_json || '{}');

    await env.DB.prepare(
      `INSERT INTO solar_requests (
        id, request_id, customer_id, customer_name, customer_phone,
        governorate, location, system_type, tier, system_size_kw, estimated_cost,
        inputs_json, calculated_outputs_json, status, notes, admin_notes, supplier_contacted,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )`
    )
      .bind(
        id,
        requestId,
        body.customer_id || body.customerId || null,
        body.customer_name || body.customerName,
        body.customer_phone || body.customerPhone,
        body.governorate || 'القاهرة',
        body.location || 'مصر',
        systemType,
        tier,
        typeof body.system_size_kw === 'number' ? body.system_size_kw : (body.calculatedOutputs?.systemSizeKw || 0.0),
        typeof body.estimated_cost === 'number' ? body.estimated_cost : (body.calculatedOutputs?.estimatedCost || 0.0),
        inputsJson,
        outputsJson,
        body.status || 'pending',
        body.notes || null,
        body.admin_notes || body.adminNotes || null,
        body.supplier_contacted || body.supplierContacted || null
      )
      .run();

    return successJson({ message: 'Solar request created successfully', id, request_id: requestId }, 201, request);
  }

  if (method === 'PUT') {
    if (!reqIdentifier) return errorJson('ID or request_id required in path', 400, request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const existing: any = await env.DB.prepare('SELECT id FROM solar_requests WHERE id = ? OR request_id = ?')
      .bind(reqIdentifier, reqIdentifier)
      .first();
    if (!existing) return errorJson(`Solar request not found: ${reqIdentifier}`, 404, request);

    await env.DB.prepare(
      `UPDATE solar_requests SET
        status = COALESCE(?, status),
        admin_notes = COALESCE(?, admin_notes),
        supplier_contacted = COALESCE(?, supplier_contacted),
        notes = COALESCE(?, notes),
        updated_at = datetime('now')
      WHERE id = ?`
    )
      .bind(
        body.status || null,
        body.admin_notes || body.adminNotes || null,
        body.supplier_contacted || body.supplierContacted || null,
        body.notes || null,
        existing.id
      )
      .run();

    return successJson({ message: 'Solar request updated successfully', id: existing.id }, 200, request);
  }

  if (method === 'DELETE') {
    if (!reqIdentifier) return errorJson('ID or request_id required in path', 400, request);

    const existing: any = await env.DB.prepare('SELECT id FROM solar_requests WHERE id = ? OR request_id = ?')
      .bind(reqIdentifier, reqIdentifier)
      .first();
    if (!existing) return errorJson(`Solar request not found: ${reqIdentifier}`, 404, request);

    await env.DB.prepare('DELETE FROM solar_requests WHERE id = ?').bind(existing.id).run();
    return successJson({ message: 'Solar request deleted successfully', id: existing.id }, 200, request);
  }

  return errorJson(`Method ${method} not allowed for /solar-requests`, 405, request);
}

// ============================================================================
// 6. /quotations Handler (New Table)
// ============================================================================
async function handleQuotations(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const quotationId = parts[1]; // /quotations/:id
  const url = new URL(request.url);

  if (method === 'GET') {
    if (quotationId) {
      const quotation = await env.DB.prepare('SELECT * FROM quotations WHERE id = ? OR request_id = ?')
        .bind(quotationId, quotationId)
        .first();
      if (!quotation) return errorJson(`Quotation not found: ${quotationId}`, 404, request);
      return successJson({ quotation }, 200, request);
    }

    const customerId = url.searchParams.get('customer_id') || url.searchParams.get('customerId');
    const phone = url.searchParams.get('phone');
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

    let query = 'SELECT * FROM quotations WHERE 1=1';
    const params: any[] = [];

    if (customerId) {
      query += ' AND (customer_id = ? OR user_id = ?)';
      params.push(customerId, customerId);
    }
    if (phone) {
      query += ' AND phone = ?';
      params.push(phone);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return successJson({ count: results.length, quotations: results }, 200, request);
  }

  if (method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const customerName = body.customer_name || body.customerName || body.name;
    const phone = body.phone || body.customerPhone;
    if (!customerName || !phone) {
      return errorJson("Missing required fields: 'customer_name' and 'phone'", 400, request);
    }

    const id = body.id || generateId('qtn');
    const requestId = body.request_id || body.requestId || null;

    // Check conflict
    if (requestId) {
      const conflict = await env.DB.prepare('SELECT id FROM quotations WHERE request_id = ?').bind(requestId).first();
      if (conflict) {
        return errorJson(`Quotation with request_id '${requestId}' already exists`, 409, request);
      }
    }

    const systemType = body.system_type || body.systemType || 'hybrid';
    const priceEstimate = typeof body.price_estimate === 'number' ? body.price_estimate : (typeof body.priceEstimate === 'number' ? body.priceEstimate : 0.0);

    await env.DB.prepare(
      `INSERT INTO quotations (
        id, request_id, customer_id, user_id, customer_name, customer_email,
        phone, system_type, system_type_name, location, governorate,
        usage, monthly_bill, battery_required, system_specs, target_tier,
        price_estimate, status, notes, supplier_contacted,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )`
    )
      .bind(
        id,
        requestId,
        body.customer_id || body.customerId || null,
        body.user_id || body.userId || null,
        customerName,
        body.customer_email || body.customerEmail || body.email || null,
        phone,
        systemType,
        body.system_type_name || body.systemTypeName || null,
        body.location || 'مصر',
        body.governorate || 'القاهرة',
        typeof body.usage === 'number' ? body.usage : null,
        typeof body.monthly_bill === 'number' ? body.monthly_bill : (body.monthlyBill || null),
        body.battery_required || body.batteryRequired ? 1 : 0,
        body.system_specs || body.systemSpecs || null,
        body.target_tier || body.targetTier || 'recommended',
        priceEstimate,
        body.status || 'pending',
        body.notes || null,
        body.supplier_contacted || body.supplierContacted || null
      )
      .run();

    return successJson({ message: 'Quotation created successfully', quotation_id: id, request_id: requestId }, 201, request);
  }

  if (method === 'PUT') {
    if (!quotationId) return errorJson('Quotation ID required in path', 400, request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const existing: any = await env.DB.prepare('SELECT id FROM quotations WHERE id = ? OR request_id = ?')
      .bind(quotationId, quotationId)
      .first();
    if (!existing) return errorJson(`Quotation not found: ${quotationId}`, 404, request);

    await env.DB.prepare(
      `UPDATE quotations SET
        status = COALESCE(?, status),
        price_estimate = COALESCE(?, price_estimate),
        notes = COALESCE(?, notes),
        supplier_contacted = COALESCE(?, supplier_contacted),
        system_specs = COALESCE(?, system_specs),
        updated_at = datetime('now')
      WHERE id = ?`
    )
      .bind(
        body.status || null,
        typeof body.price_estimate === 'number' ? body.price_estimate : (typeof body.priceEstimate === 'number' ? body.priceEstimate : null),
        body.notes || null,
        body.supplier_contacted || body.supplierContacted || null,
        body.system_specs || body.systemSpecs || null,
        existing.id
      )
      .run();

    return successJson({ message: 'Quotation updated successfully', quotation_id: existing.id }, 200, request);
  }

  if (method === 'DELETE') {
    if (!quotationId) return errorJson('Quotation ID required in path', 400, request);

    const existing: any = await env.DB.prepare('SELECT id FROM quotations WHERE id = ? OR request_id = ?')
      .bind(quotationId, quotationId)
      .first();
    if (!existing) return errorJson(`Quotation not found: ${quotationId}`, 404, request);

    await env.DB.prepare('DELETE FROM quotations WHERE id = ?').bind(existing.id).run();
    return successJson({ message: 'Quotation deleted successfully', quotation_id: existing.id }, 200, request);
  }

  return errorJson(`Method ${method} not allowed for /quotations`, 405, request);
}

// ============================================================================
// 7. /quotation-items Handler (New Table)
// ============================================================================
async function handleQuotationItems(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const itemId = parts[1]; // /quotation-items/:id
  const url = new URL(request.url);

  if (method === 'GET') {
    if (itemId) {
      const item = await env.DB.prepare('SELECT * FROM quotation_items WHERE id = ?').bind(itemId).first();
      if (!item) return errorJson(`Quotation item not found: ${itemId}`, 404, request);
      return successJson({ item }, 200, request);
    }

    const quotationId = url.searchParams.get('quotation_id') || url.searchParams.get('quotationId');
    if (!quotationId) {
      return errorJson("Query parameter 'quotation_id' is required to list quotation items", 400, request);
    }

    const { results } = await env.DB.prepare(
      'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY created_at ASC'
    )
      .bind(quotationId)
      .all();

    return successJson({ count: results.length, items: results }, 200, request);
  }

  if (method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    if (!body.quotation_id && !body.quotationId) {
      return errorJson("Missing required field: 'quotation_id'", 400, request);
    }
    if (!body.item_type || !body.item_name) {
      return errorJson("Missing required fields: 'item_type' and 'item_name'", 400, request);
    }

    const quotationId = body.quotation_id || body.quotationId;
    const parentQuotation = await env.DB.prepare('SELECT id FROM quotations WHERE id = ?').bind(quotationId).first();
    if (!parentQuotation) {
      return errorJson(`Referenced quotation '${quotationId}' does not exist`, 404, request);
    }

    const id = body.id || generateId('item');
    const quantity = typeof body.quantity === 'number' ? body.quantity : 1.0;
    const unitPrice = typeof body.unit_price === 'number' ? body.unit_price : (body.unitPrice || 0.0);
    const totalPrice = typeof body.total_price === 'number' ? body.total_price : (body.totalPrice || quantity * unitPrice);

    await env.DB.prepare(
      `INSERT INTO quotation_items (
        id, quotation_id, product_id, item_type, item_name,
        model, quantity, unit_price, total_price, specs, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, datetime('now')
      )`
    )
      .bind(
        id,
        quotationId,
        body.product_id || body.productId || null,
        body.item_type,
        body.item_name,
        body.model || null,
        quantity,
        unitPrice,
        totalPrice,
        body.specs || null
      )
      .run();

    return successJson({ message: 'Quotation item created successfully', item_id: id }, 201, request);
  }

  if (method === 'PUT') {
    if (!itemId) return errorJson('Quotation item ID required in path', 400, request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const existing: any = await env.DB.prepare('SELECT id, quantity, unit_price FROM quotation_items WHERE id = ?')
      .bind(itemId)
      .first();
    if (!existing) return errorJson(`Quotation item not found: ${itemId}`, 404, request);

    const newQty = typeof body.quantity === 'number' ? body.quantity : (existing.quantity as number);
    const newUnitPrice = typeof body.unit_price === 'number' ? body.unit_price : (existing.unit_price as number);
    const newTotal = typeof body.total_price === 'number' ? body.total_price : newQty * newUnitPrice;

    await env.DB.prepare(
      `UPDATE quotation_items SET
        item_name = COALESCE(?, item_name),
        model = COALESCE(?, model),
        quantity = ?,
        unit_price = ?,
        total_price = ?,
        specs = COALESCE(?, specs)
      WHERE id = ?`
    )
      .bind(
        body.item_name || null,
        body.model || null,
        newQty,
        newUnitPrice,
        newTotal,
        body.specs || null,
        itemId
      )
      .run();

    return successJson({ message: 'Quotation item updated successfully', item_id: itemId }, 200, request);
  }

  if (method === 'DELETE') {
    if (!itemId) return errorJson('Quotation item ID required in path', 400, request);

    const existing = await env.DB.prepare('SELECT id FROM quotation_items WHERE id = ?').bind(itemId).first();
    if (!existing) return errorJson(`Quotation item not found: ${itemId}`, 404, request);

    await env.DB.prepare('DELETE FROM quotation_items WHERE id = ?').bind(itemId).run();
    return successJson({ message: 'Quotation item deleted successfully', item_id: itemId }, 200, request);
  }

  return errorJson(`Method ${method} not allowed for /quotation-items`, 405, request);
}

// ============================================================================
// 8. /reviews Handler (New Table: product_reviews)
// ============================================================================
async function handleProductReviews(request: Request, env: Env, path: string, method: string): Promise<Response> {
  const parts = path.split('/').filter(Boolean);
  const reviewId = parts[1]; // /reviews/:id
  const url = new URL(request.url);

  if (method === 'GET') {
    if (reviewId) {
      const review = await env.DB.prepare('SELECT * FROM product_reviews WHERE id = ?').bind(reviewId).first();
      if (!review) return errorJson(`Review not found: ${reviewId}`, 404, request);
      return successJson({ review }, 200, request);
    }

    const productId = url.searchParams.get('product_id') || url.searchParams.get('productId');
    const userId = url.searchParams.get('user_id') || url.searchParams.get('userId');

    let query = 'SELECT * FROM product_reviews WHERE 1=1';
    const params: any[] = [];

    if (productId) {
      query += ' AND product_id = ?';
      params.push(productId);
    }
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC LIMIT 200';

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return successJson({ count: results.length, reviews: results }, 200, request);
  }

  if (method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const productId = body.product_id || body.productId;
    const userId = body.user_id || body.userId;
    const userName = body.user_name || body.userName;
    const rating = typeof body.rating === 'number' ? body.rating : parseInt(body.rating, 10);
    const comment = body.comment;

    if (!productId || !userId || !userName || !comment) {
      return errorJson("Missing required fields: 'product_id', 'user_id', 'user_name', and 'comment'", 400, request);
    }

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return errorJson("Rating must be an integer between 1 and 5", 400, request);
    }

    const id = body.id || generateId('rev');

    await env.DB.prepare(
      `INSERT INTO product_reviews (
        id, product_id, user_id, user_name, rating, comment, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, datetime('now')
      )`
    )
      .bind(id, productId, userId, userName, rating, comment)
      .run();

    return successJson({ message: 'Review added successfully', review_id: id }, 201, request);
  }

  if (method === 'PUT') {
    if (!reviewId) return errorJson('Review ID required in path', 400, request);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorJson('Invalid JSON payload in request body', 400, request);
    }

    const existing = await env.DB.prepare('SELECT id FROM product_reviews WHERE id = ?').bind(reviewId).first();
    if (!existing) return errorJson(`Review not found: ${reviewId}`, 404, request);

    let rating = null;
    if (body.rating !== undefined) {
      rating = typeof body.rating === 'number' ? body.rating : parseInt(body.rating, 10);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return errorJson("Rating must be an integer between 1 and 5", 400, request);
      }
    }

    await env.DB.prepare(
      `UPDATE product_reviews SET
        rating = COALESCE(?, rating),
        comment = COALESCE(?, comment)
      WHERE id = ?`
    )
      .bind(rating, body.comment || null, reviewId)
      .run();

    return successJson({ message: 'Review updated successfully', review_id: reviewId }, 200, request);
  }

  if (method === 'DELETE') {
    if (!reviewId) return errorJson('Review ID required in path', 400, request);

    const existing = await env.DB.prepare('SELECT id FROM product_reviews WHERE id = ?').bind(reviewId).first();
    if (!existing) return errorJson(`Review not found: ${reviewId}`, 404, request);

    await env.DB.prepare('DELETE FROM product_reviews WHERE id = ?').bind(reviewId).run();
    return successJson({ message: 'Review deleted successfully', review_id: reviewId }, 200, request);
  }

  return errorJson(`Method ${method} not allowed for /reviews`, 405, request);
}

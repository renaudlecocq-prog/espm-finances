// ── Mock Supabase client pour le mode démo ────────────────────────────────
// Simule les appels Supabase sans toucher à la vraie base de données.

class MockQuery {
  constructor(data) {
    this._data = Array.isArray(data) ? [...data] : []
  }

  select(cols) { return new MockQuery(this._data) }

  eq(col, val) {
    return new MockQuery(this._data.filter(r => {
      const v = r[col]
      return v === '*' || v === val || String(v) === String(val)
    }))
  }

  neq(col, val) {
    return new MockQuery(this._data.filter(r => r[col] !== val))
  }

  in(col, vals) {
    return new MockQuery(this._data.filter(r => vals.includes(r[col])))
  }

  gte(col, val) { return new MockQuery(this._data.filter(r => r[col] >= val)) }
  lte(col, val) { return new MockQuery(this._data.filter(r => r[col] <= val)) }
  gt(col, val)  { return new MockQuery(this._data.filter(r => r[col] > val)) }
  lt(col, val)  { return new MockQuery(this._data.filter(r => r[col] < val)) }

  ilike(col, pattern) {
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i')
    return new MockQuery(this._data.filter(r => regex.test(String(r[col] || ''))))
  }

  order(col, { ascending = true } = {}) {
    const sorted = [...this._data].sort((a, b) => {
      const av = a[col] ?? '', bv = b[col] ?? ''
      if (av < bv) return ascending ? -1 : 1
      if (av > bv) return ascending ? 1 : -1
      return 0
    })
    return new MockQuery(sorted)
  }

  limit(n)        { return new MockQuery(this._data.slice(0, n)) }
  range(f, t)     { return new MockQuery(this._data.slice(f, t + 1)) }
  filter(col, op, val) { return new MockQuery(this._data) }  // simplification

  single()      { return Promise.resolve({ data: this._data[0] ?? null, error: null }) }
  maybeSingle() { return Promise.resolve({ data: this._data[0] ?? null, error: null }) }

  // Thenable = compatible avec await et Promise.all()
  then(onFulfilled, onRejected) {
    return Promise.resolve({ data: this._data, error: null }).then(onFulfilled, onRejected)
  }
  catch(fn)   { return this.then(undefined, fn) }
  finally(fn) { return Promise.resolve({ data: this._data, error: null }).finally(fn) }
}

const noopWrite = {
  eq:     () => noopWrite,
  neq:    () => noopWrite,
  match:  () => noopWrite,
  then:   (cb) => Promise.resolve({ data: null, error: null }).then(cb),
  catch:  (cb) => Promise.resolve({ data: null, error: null }),
}

class MockTable {
  constructor(data) { this._data = Array.isArray(data) ? data : [] }
  select(cols = '*') { return new MockQuery(this._data) }
  insert(rows)       { return Promise.resolve({ data: Array.isArray(rows) ? rows : [rows], error: null }) }
  upsert(rows)       { return Promise.resolve({ data: Array.isArray(rows) ? rows : [rows], error: null }) }
  update(changes)    { return noopWrite }
  delete()           { return noopWrite }
}

export function createMockClient(demoData) {
  return {
    from: (table) => new MockTable(demoData[table] || []),
  }
}

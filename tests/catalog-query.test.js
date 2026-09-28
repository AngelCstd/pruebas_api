const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LocalCatalogRepository } = require('../dist/repositories/local-catalog.repository');

const repository = new LocalCatalogRepository();

for (const [method, textField] of [['getAmenities', 'description'], ['getSuppliers', 'name'], ['getAccommodationTypes', 'description']]) {
  test(`${method}: exact lists, search, sorting, and page boundaries`, async () => {
    const scope = method === 'getAmenities' ? { groupCode: 'MNO.HTL.AMT.SER' } : {};
    const run = query => repository[method]({ ...scope, ...query });
    const first = await run({ limit: 100 });
    const codes = first.data.slice(0, 3).map(item => item.code);
    const selected = await run({ codes: ` ${codes.join(', ')},${codes[0]},,` });
    assert.deepEqual(selected.data.map(item => item.code), codes);
    assert.equal(selected.total, 3);
    const descending = await run({ codes: codes.join(','), sortOrder: 'DESC' });
    assert.deepEqual(descending.data.map(item => item.code), [...codes].reverse());
    const last = await run({ codes: codes.join(','), limit: 2, page: 2 });
    assert.equal(last.total, 3);
    assert.equal(last.totalPages, 2);
    assert.deepEqual(last.data.map(item => item.code), [codes[2]]);
    const beyond = await run({ codes: codes.join(','), limit: 2, page: 3 });
    assert.deepEqual(beyond.data, []);
    assert.equal(beyond.total, 3);
    assert.equal(beyond.page, 3);
    for (const codes of ['missing-code', ', ,', '']) {
      assert.deepEqual(await run({ codes }), { data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    }
    const item = first.data[0];
    for (const search of [item.code.toLowerCase(), item[textField].slice(0, 4).toUpperCase()]) {
      const result = await run({ codes: item.code, search: ` ${search} ` });
      assert.deepEqual(result.data, [item]);
    }
    assert.equal((await run({ codes: item.code, search: 'impossible-search-value' })).total, 0);
    assert.deepEqual(await run({ limit: 100 }), first, 'queries must not reorder caches');
  });
}

test('amenity group filters combine with code lists and search', async () => {
  const groups = await repository.getAmenityGroups();
  const chosen = [];
  for (const group of groups) {
    const result = await repository.getAmenities({ groupCode: group.code, limit: 1 });
    if (result.data.length) chosen.push(result.data[0]);
    if (chosen.length === 2) break;
  }
  assert.equal(chosen.length, 2);
  const query = { groupCodes: chosen.map(item => item.groupCode.toLowerCase()).join(', '), codes: chosen.map(item => item.code).join(',') };
  const result = await repository.getAmenities(query);
  assert.equal(result.total, 2);
  const combined = await repository.getAmenities({ ...query, groupCode: chosen[0].groupCode.toLowerCase(), search: chosen[0].description.toUpperCase() });
  assert.deepEqual(combined.data, [chosen[0]]);
  assert.equal((await repository.getAmenities({ ...query, groupCode: 'missing-group' })).total, 0);
});

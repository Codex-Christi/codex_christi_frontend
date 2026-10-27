import type {
  CartCheckoutSnapshot,
  CartCommand,
  CartDocument,
  CartFlight,
  CartOwner,
  CartPurchaseLine,
  CartVariant,
  VariantDetail,
} from './types';

export const MAX_CART_QUANTITY = 2_147_483_647;
const RECEIPT_LIMIT = 200;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, limit = 2_048): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= limit;

export const isCartVariantId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,254}$/.test(value) &&
  !Object.hasOwn(Object.prototype, value);

export const isCartQuantity = (value: unknown, allowZero = false): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= (allowZero ? 0 : 1) &&
  value <= MAX_CART_QUANTITY;

function assertQuantity(value: unknown, allowZero = false): asserts value is number {
  if (!isCartQuantity(value, allowZero)) throw new Error('Choose a valid whole-number quantity.');
}

function normalizeOptions(value: unknown): VariantDetail['options'] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const valid = value.every(
    (option) =>
      isRecord(option) &&
      typeof option.name === 'string' &&
      typeof option.value === 'string' &&
      option.name.length <= 500 &&
      option.value.length <= 500 &&
      (option.attribute === undefined ||
        (isRecord(option.attribute) &&
          text(option.attribute.name, 100) &&
          text(option.attribute.value_type, 100))),
  );
  if (!valid) return null;
  return value.map((option) => ({
    name: option.name,
    value: option.value,
    ...(typeof option.slug === 'string' ? { slug: option.slug.slice(0, 500) } : {}),
    ...(typeof option.is_preselected === 'boolean'
      ? { is_preselected: option.is_preselected }
      : {}),
    ...(typeof option.hide_storefront === 'boolean'
      ? { hide_storefront: option.hide_storefront }
      : {}),
    ...(typeof option.position === 'number' && Number.isFinite(option.position)
      ? { position: option.position }
      : {}),
    ...(isRecord(option.attribute)
      ? {
          attribute: {
            name: option.attribute.name,
            value_type: option.attribute.value_type,
            ...(typeof option.attribute._id === 'string' ? { _id: option.attribute._id } : {}),
          },
        }
      : {}),
  })) as VariantDetail['options'];
}

/** Keep only valid display metadata; purchase pricing and availability are verified separately. */
export function normalizeCartLine(value: unknown): CartVariant | null {
  if (!isRecord(value) || !isCartVariantId(value.variantId) || !isCartQuantity(value.quantity))
    return null;
  const detail = value.itemDetail;
  if (!isRecord(detail) || detail._id !== value.variantId) return null;
  const options = normalizeOptions(detail.options);
  if (
    !options ||
    typeof detail.retail_price !== 'number' ||
    !Number.isFinite(detail.retail_price) ||
    detail.retail_price < 0 ||
    !Array.isArray(detail.image_uris) ||
    detail.image_uris.length > 50 ||
    !detail.image_uris.every((image) => text(image))
  )
    return null;

  const title = text(value.title, 1_000)
    ? value.title
    : text(detail.title, 1_000)
      ? detail.title
      : 'Saved product';
  const itemDetail: VariantDetail = {
    _id: value.variantId,
    title: text(detail.title, 1_000) ? detail.title : title,
    retail_price: detail.retail_price,
    image_uris: [...detail.image_uris] as string[],
    is_default: detail.is_default === true,
    options,
  };
  for (const key of ['sku', 'sku_seller', 'supplierSku', 'product', 'image'] as const) {
    if (text(detail[key])) itemDetail[key] = detail[key];
  }
  for (const key of ['weight', 'base_cost'] as const) {
    if (typeof detail[key] === 'number' && Number.isFinite(detail[key]) && detail[key] >= 0)
      itemDetail[key] = detail[key];
  }
  if (Array.isArray(detail.sides) && detail.sides.every((side) => text(side)))
    itemDetail.sides = detail.sides.slice(0, 50) as string[];

  return {
    variantId: value.variantId,
    quantity: value.quantity,
    title,
    slug: text(value.slug, 500) ? value.slug : itemDetail.product || value.variantId,
    itemDetail,
  };
}

/** Recover valid lines, coalescing repeated identities without exceeding the API's integer bound. */
export function normalizeCartLines(value: unknown): CartVariant[] {
  if (!Array.isArray(value)) return [];
  const lines = new Map<string, CartVariant>();
  for (const item of value) {
    const line = normalizeCartLine(item);
    if (!line) continue;
    const previous = lines.get(line.variantId);
    lines.set(line.variantId, {
      ...line,
      quantity: Math.min(MAX_CART_QUANTITY, (previous?.quantity ?? 0) + line.quantity),
    });
  }
  return [...lines.values()];
}

export function createCartDocument(owner: CartOwner, id: string): CartDocument {
  return {
    version: 1,
    owner,
    cartId: id,
    revision: 0,
    baseline: [],
    fetched: owner === 'guest',
    edits: {},
    flights: {},
    lineage: {},
    consumedOrderIds: [],
    importedGuestIds: [],
    checkoutSnapshots: {},
  };
}

export function projectCart(document: CartDocument): CartVariant[] {
  const lines = new Map(document.baseline.map((line) => [line.variantId, line]));
  for (const [variantId, edit] of Object.entries(document.edits)) {
    if (edit.quantity === 0) lines.delete(variantId);
    else lines.set(variantId, { ...edit.line, quantity: edit.quantity });
  }
  return [...lines.values()];
}

const quantityOf = (lines: CartVariant[], variantId: string) =>
  lines.find((line) => line.variantId === variantId)?.quantity ?? 0;

function putEdit(document: CartDocument, line: CartVariant, quantity: number, id: string) {
  const variantId = line.variantId;
  const previous = document.edits[variantId];
  const baseQuantity =
    previous?.baseQuantity ?? (document.fetched ? quantityOf(document.baseline, variantId) : null);
  const edits = { ...document.edits };
  if (
    !document.flights[variantId] &&
    !previous?.conflict &&
    (quantity === baseQuantity || (baseQuantity === null && quantity === 0))
  ) {
    delete edits[variantId];
  } else {
    edits[variantId] = {
      id,
      line,
      quantity,
      baseQuantity,
      ...(previous?.merge || baseQuantity === null ? { merge: true } : {}),
      ...(previous?.conflict ? { conflict: previous.conflict } : {}),
    };
  }
  return { ...document, edits };
}

export function editCart(document: CartDocument, command: CartCommand, id: string): CartDocument {
  const current = projectCart(document);
  if (command.type === 'clear') {
    return current.reduce(
      (next, line) =>
        editCart(next, { type: 'remove', variantId: line.variantId }, `${id}:${line.variantId}`),
      document,
    );
  }
  if (command.type === 'add') {
    const line = normalizeCartLine(command.line);
    if (!line) throw new Error('This product selection cannot be saved to the cart.');
    const existing = current.find((item) => item.variantId === line.variantId);
    const quantity = (existing?.quantity ?? 0) + line.quantity;
    assertQuantity(quantity);
    const next = putEdit(document, line, quantity, id);
    return {
      ...next,
      lineage: {
        ...document.lineage,
        [line.variantId]: existing
          ? document.lineage[line.variantId] || `${document.cartId}:${line.variantId}`
          : id,
      },
    };
  }
  if (!isCartVariantId(command.variantId))
    throw new Error('This cart item has an invalid identity.');
  const existing = current.find((line) => line.variantId === command.variantId);
  const quantity = command.type === 'remove' ? 0 : command.quantity;
  assertQuantity(quantity, true);
  if (!existing) {
    if (quantity > 0) throw new Error('This item is no longer in the cart.');
    return document;
  }
  return putEdit(document, existing, quantity, id);
}

/** Three-way comparison: the server may update the baseline, but it cannot erase local intent. */
export function reconcileCart(document: CartDocument, remote: CartVariant[]): CartDocument {
  const baseline = normalizeCartLines(remote);
  const edits = { ...document.edits };
  for (const [variantId, edit] of Object.entries(edits)) {
    const remoteQuantity = quantityOf(baseline, variantId);
    const flight = document.flights[variantId];
    if (edit.baseQuantity === null) {
      const quantity = edit.merge ? remoteQuantity + edit.quantity : edit.quantity;
      assertQuantity(quantity, true);
      if (quantity === remoteQuantity && !flight) delete edits[variantId];
      else edits[variantId] = { ...edit, quantity, baseQuantity: remoteQuantity, merge: undefined };
      continue;
    }
    if (flight) {
      if (flight.phase === 'uncertain' && remoteQuantity !== edit.baseQuantity)
        edits[variantId] = { ...edit, conflict: { remoteQuantity } };
      continue;
    }
    if (remoteQuantity === edit.quantity) {
      delete edits[variantId];
    } else if (remoteQuantity !== edit.baseQuantity) {
      edits[variantId] = { ...edit, conflict: { remoteQuantity } };
    } else if (edit.conflict) {
      edits[variantId] = { ...edit, conflict: undefined };
    }
  }
  const next = { ...document, baseline, fetched: true, edits };
  const previousIds = new Set(projectCart(document).map((line) => line.variantId));
  const lineage = { ...document.lineage };
  for (const line of projectCart(next)) {
    if (!lineage[line.variantId] || !previousIds.has(line.variantId))
      lineage[line.variantId] = `${document.cartId}:${document.revision}:${line.variantId}`;
  }
  return { ...next, lineage };
}

export function settleCartWrite(
  document: CartDocument,
  flight: CartFlight,
  remote: CartVariant[],
): CartDocument {
  if (document.flights[flight.variantId]?.editId !== flight.editId) return document;
  const baseline = normalizeCartLines(remote);
  const remoteQuantity = quantityOf(baseline, flight.variantId);
  const edits = { ...document.edits };
  const flights = { ...document.flights };
  const edit = edits[flight.variantId];
  if (remoteQuantity === flight.quantity) {
    delete flights[flight.variantId];
    if (edit?.id === flight.editId || edit?.quantity === remoteQuantity)
      delete edits[flight.variantId];
    else if (edit)
      edits[flight.variantId] = {
        ...edit,
        baseQuantity: remoteQuantity,
        merge: undefined,
        conflict: undefined,
        error: undefined,
      };
  } else {
    flights[flight.variantId] = { ...flight, phase: 'uncertain' };
    if (edit) edits[flight.variantId] = { ...edit, conflict: { remoteQuantity } };
  }
  return reconcileCart({ ...document, edits, flights }, baseline);
}

export function resolveCartConflict(
  document: CartDocument,
  variantId: string,
  choice: 'local' | 'remote',
  id: string,
): CartDocument {
  const edit = document.edits[variantId];
  if (!edit) return document;
  const remoteQuantity = quantityOf(document.baseline, variantId);
  const edits = { ...document.edits };
  const flights = { ...document.flights };
  delete flights[variantId];
  if (choice === 'remote' || edit.quantity === remoteQuantity) delete edits[variantId];
  else
    edits[variantId] = {
      id,
      line: edit.line,
      quantity: edit.quantity,
      baseQuantity: remoteQuantity,
    };
  return { ...document, edits, flights };
}

export function mergeGuestCart(
  account: CartDocument,
  guest: CartDocument,
  idFactory: () => string,
): CartDocument {
  if (account.owner === 'guest' || guest.owner !== 'guest')
    throw new Error('Guest cart merging requires a signed-in account.');
  if (account.importedGuestIds.includes(guest.cartId)) return account;
  const guestLines = projectCart(guest);
  if (guestLines.length === 0) return account;
  const next = guestLines.reduce(
    (document, line) => editCart(document, { type: 'add', line }, idFactory()),
    account,
  );
  return {
    ...next,
    importedGuestIds: [...next.importedGuestIds, guest.cartId].slice(-RECEIPT_LIMIT),
  };
}

export function consumeCartPurchase(
  document: CartDocument,
  orderId: string,
  lines: CartPurchaseLine[],
  idFactory: () => string,
): CartDocument {
  if (!text(orderId) || document.consumedOrderIds.includes(orderId)) return document;
  let next = document;
  for (const purchased of lines) {
    if (!isCartVariantId(purchased.variantId) || !isCartQuantity(purchased.quantity)) continue;
    if (purchased.lineage && purchased.lineage !== next.lineage[purchased.variantId]) continue;
    const line = projectCart(next).find((item) => item.variantId === purchased.variantId);
    if (line)
      next = editCart(
        next,
        {
          type: 'setQuantity',
          variantId: line.variantId,
          quantity: Math.max(0, line.quantity - purchased.quantity),
        },
        idFactory(),
      );
  }
  return { ...next, consumedOrderIds: [...next.consumedOrderIds, orderId].slice(-RECEIPT_LIMIT) };
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => text(item)).slice(-RECEIPT_LIMIT)
    : [];
}

export function normalizeCartDocument(value: unknown, owner: CartOwner): CartDocument | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.owner !== owner ||
    !text(value.cartId) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !Array.isArray(value.baseline)
  )
    return null;
  const document = createCartDocument(owner, value.cartId);
  document.revision = value.revision as number;
  document.fetched = owner === 'guest' || value.fetched === true;
  document.baseline = normalizeCartLines(value.baseline);
  document.consumedOrderIds = stringList(value.consumedOrderIds);
  document.importedGuestIds = stringList(value.importedGuestIds);
  if (isRecord(value.edits))
    for (const [variantId, candidate] of Object.entries(value.edits)) {
      if (
        !isCartVariantId(variantId) ||
        !isRecord(candidate) ||
        !text(candidate.id) ||
        !isCartQuantity(candidate.quantity, true) ||
        !(candidate.baseQuantity === null || isCartQuantity(candidate.baseQuantity, true))
      )
        continue;
      const line = normalizeCartLine(candidate.line);
      if (!line || line.variantId !== variantId) continue;
      document.edits[variantId] = {
        id: candidate.id,
        line,
        quantity: candidate.quantity,
        baseQuantity: candidate.baseQuantity,
        ...(candidate.merge === true && candidate.baseQuantity === null ? { merge: true } : {}),
        ...(isRecord(candidate.conflict) && isCartQuantity(candidate.conflict.remoteQuantity, true)
          ? { conflict: { remoteQuantity: candidate.conflict.remoteQuantity } }
          : {}),
        ...(text(candidate.error) ? { error: candidate.error } : {}),
      };
    }
  if (isRecord(value.flights))
    for (const [variantId, candidate] of Object.entries(value.flights)) {
      if (
        !isCartVariantId(variantId) ||
        !isRecord(candidate) ||
        candidate.variantId !== variantId ||
        !text(candidate.editId) ||
        !isCartQuantity(candidate.quantity, true) ||
        !isCartQuantity(candidate.baseQuantity, true) ||
        !['add', 'update', 'remove'].includes(String(candidate.kind)) ||
        !['sending', 'uncertain'].includes(String(candidate.phase))
      )
        continue;
      document.flights[variantId] = {
        editId: candidate.editId,
        variantId,
        quantity: candidate.quantity,
        baseQuantity: candidate.baseQuantity,
        kind: candidate.kind as CartFlight['kind'],
        phase: candidate.phase as CartFlight['phase'],
        ...(candidate.acknowledged === true ? { acknowledged: true } : {}),
        ...(text(candidate.error) ? { error: candidate.error } : {}),
      };
    }
  for (const line of projectCart(document)) {
    const lineage = isRecord(value.lineage) ? value.lineage[line.variantId] : undefined;
    document.lineage[line.variantId] = text(lineage)
      ? lineage
      : `${document.cartId}:${line.variantId}`;
  }
  if (isRecord(value.checkoutSnapshots))
    for (const [orderId, candidate] of Object.entries(value.checkoutSnapshots).slice(
      -RECEIPT_LIMIT,
    )) {
      if (
        !text(orderId) ||
        Object.hasOwn(Object.prototype, orderId) ||
        !isRecord(candidate) ||
        candidate.owner !== owner ||
        candidate.cartId !== document.cartId ||
        !Array.isArray(candidate.lines)
      )
        continue;
      const lines: CartPurchaseLine[] = candidate.lines.flatMap((line) =>
        isRecord(line) && isCartVariantId(line.variantId) && isCartQuantity(line.quantity)
          ? [
              {
                variantId: line.variantId,
                quantity: line.quantity,
                ...(text(line.lineage) ? { lineage: line.lineage } : {}),
              },
            ]
          : [],
      );
      document.checkoutSnapshots[orderId] = {
        owner,
        cartId: document.cartId,
        lines,
      } satisfies CartCheckoutSnapshot;
    }
  return document;
}

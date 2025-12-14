export function getUpdatedKeys<T extends object>(obj1: T, obj2: Partial<T>): Partial<T> {
  const updatedKeys: Partial<Record<keyof T, T[keyof T]>> = {};

  if (!obj1 || !obj2 || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return updatedKeys as Partial<T>; // Handle cases where inputs are not valid objects
  }

  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    if (Object.prototype.hasOwnProperty.call(obj2, key)) {
      const obj1Value = obj1[key as keyof T];
      const obj2Value = obj2[key as keyof T];
      if (obj1Value !== obj2Value) {
        updatedKeys[key as keyof T] = obj2Value;
      }
    }
  }

  return updatedKeys as Partial<T>;
}

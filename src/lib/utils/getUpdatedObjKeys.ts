export function getUpdatedKeys<T extends object>(obj1: T, obj2: T): Partial<T> {
  const updatedKeys: Partial<Record<keyof T, T[keyof T]>> = {};

  if (!obj1 || !obj2 || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return updatedKeys as Partial<T>; // Handle cases where inputs are not valid objects
  }

  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    if (obj1.hasOwnProperty(key) && obj2.hasOwnProperty(key)) {
      // Case 1: Key exists in both objects
      if (obj1[key as keyof T] !== obj2[key as keyof T]) {
        updatedKeys[key as keyof T] = obj2[key as keyof T]; // Add the new value
      }
    } else if (obj2.hasOwnProperty(key)) {
      // Case 2: Key only exists in obj2 (newly added)
      updatedKeys[key as keyof T] = obj2[key as keyof T];
    }
  }

  return updatedKeys as Partial<T>;
}

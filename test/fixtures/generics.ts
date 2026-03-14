// Angle brackets in generics should NOT be treated as comparison operators
function identity<T>(value: T): T {
  return value;
}

function toArray<T>(value: T): Array<T> {
  return [value];
}

function compare(a: number, b: number): boolean {
  return a < b;
}

export { identity, toArray, compare };

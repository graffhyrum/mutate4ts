function add(a: number, b: number): number {
  return a + b;
}

function isPositive(n: number): boolean {
  return n > 0;
}

function isEven(n: number): boolean {
  return n % 2 === 0;
}

function negate(value: boolean): boolean {
  return !value;
}

function getDefault(): number {
  return 1;
}

function check(a: boolean, b: boolean): boolean {
  return a && b;
}

export { add, isPositive, isEven, negate, getDefault, check };

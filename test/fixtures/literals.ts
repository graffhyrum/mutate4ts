// Operators inside strings should NOT be mutated
const message = "1 + 2 === 3 && true || false";

// Operators inside template literals should NOT be mutated
const template = `result: ${1 + 2}`;

// Operators inside comments should NOT be mutated
// a + b === c && d || e

function realOperators(a: boolean, b: boolean): boolean {
  return a && b;
}

export { message, template, realOperators };

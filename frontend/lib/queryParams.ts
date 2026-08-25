/**
 * Strips undefined/null/"" values before handing an object to axios `params`
 * — axios otherwise serializes `undefined` fields as literal "undefined" in
 * the querystring, which the backend's typed Query params would reject.
 */
export function cleanParams<T extends object>(params: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(params) as (keyof T)[]) {
    const value = params[key];
    if (value !== undefined && value !== null && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

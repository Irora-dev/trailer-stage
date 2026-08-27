// Flat config, imported directly from eslint-config-next.
//
// Going through the eslintrc compatibility layer instead crashes while it tries
// to serialise its own config for an error message (a circular reference in the
// plugin graph), which looks like a broken repo and is not.

import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const flat = (c) => (Array.isArray(c) ? c : [c])

export default [
  ...flat(coreWebVitals),
  ...flat(typescript),
  { ignores: ['.next/**', 'node_modules/**', 'scripts/**', '.takes/**', '.audio/**'] },
]

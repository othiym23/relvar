import assert from 'assert'

import { Relvar, isFixnum, serializeFixnum } from '../../'

import isColor from './lib/predicates/is-color.js'

function isPNO (str) {
  if (!/[^[Pp]\d+$]/.test(str)) {
    throw new TypeError(str + ' is not a valid part number')
  }
  return true
}

const isWeight = isFixnum(1)
const serializeWeight = serializeFixnum(1)

const parts = new Relvar([
  { name: 'PNO', type: isPNO },
  { name: 'PNAME', type: String },
  { name: 'COLOR', type: isColor, default: 'Green' },
  { name: 'WEIGHT', type: isWeight, serialize: serializeWeight },
  { name: 'CITY', type: String }
])

// works:
parts.add(new Map([
  ['PNO', 'P1'],
  // attributes can be out of order relative to heading
  ['color', 'Red'],
  ['PName', 'Nut'],
  ['WEIGHT', 12.0], // value objects don't have to be strings
  ['city', 'London']
]))

// also works:
parts.add(new Map([
  ['PNO', 'P2'],
  ['PNAME', 'Bolt'],
  // color is defaulted
  ['WEIGHT', '17.0'],
  ['CITY', 'Paris']
]))

// doesn't work:
try {
  parts.add(new Map([
    // missing PNO
    ['PNAME', 'Screw'],
    ['COLOR', 'Blue'],
    ['WEIGHT', '17.0'],
    ['CITY', 'Oslo']
  ]))
} catch (e) {
  console.warn("that wasn't a good idea:", e.message)
}

// also doesn't work:
try {
  parts.add(new Map([
    ['PNO', 'S4'], // values must be valid
    ['PNAME', 'Screw'],
    ['COLOR', 'Red'],
    ['WEIGHT', null], // values can't be null or undefined
    ['CITY', 'London']
  ]))
} catch (e) {
  console.warn('still not a good idea:', e.message)
}

let totalWeight = 0
// uses iteration protocol
for (let tuple of parts) totalWeight += tuple.get('WEIGHT')

console.log('Total weight of parts is:', totalWeight)
assert(totalWeight === 29)

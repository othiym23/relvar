relvar
======

This package allows you to define and create [relvars][relvar].

A [relvar][] (short for _relation variable_) is defined by [CJ Date][]
as the following:

> Very loosely, a table (variable); more precisely, a variable whose type is
> some relation type. Let relation variable _R_ be of declared type _T_; then
> _R_ has the same heading (and therefore the same attributes and degree) as
> type _T_ does. Let the value of _R_ at some given time be _r_; then _R_ has
> the same body and cardinality at that time as _r_ does.

A _relation type_ is analogous to a SQL _table definition_:

> Let _H_ be a heading; then (and only then) RELATION _H_ denotes a
> relation type—in fact, the sole relation type—with the same degree and
> attributes as _H_.

Finally, a _heading_ is a set of attributes that define the tuples stored in the [relvar][]:

> A set of attributes, in which (by definition) each attribute is a pair
> of the form &lt;_A_,_T_&gt;, where _A_ is an attribute name and _T_ is
> the name of the type of attribute _A_; especially, the set of attributes
> for a given relation or given relvar. Every subset of a heading is
> itself a heading. Within any given heading, (a) distinct attributes are
> allowed to have the same type name but not the same attribute name; (b)
> the number of attributes is the degree (of the heading in question).

(all quotes taken from [_The New Relational Database Dictionary_][])

To put it all together, a relvar comprises a heading that defines the
number, name, and types of the elements of a set of tuples that can
be used as an operand in the operations of the relational algebra
and calculus. When it's reified into an on-disk value, it becomes a
_relation value_. Basically, a relvar is analogous to a query result or
a database view in a SQL RDBMS, and a relation value is (more or less) a
table on disk.

This package exports a constructor for relvars as well as a set of
utility functions for validating and serializing commonly-used types for
tuple attributes. It doesn't include a relational algebra / calculus,
a storage engine, or a query language. Having all of these things
available would be super cool, though.

## defining relvars

```javascript
import Relvar from 'relvar';
import { isFixnum, serializeFixnum } from 'relvar';

import isColor from './predicates/is-color.js';

function isPNO (str) {
  if (!/[^[Pp]\d+]/.test(str)) {
    throw new TypeError(str + ' is not a valid part number');
  }
  return true;
}

const isWeight = isFixnum(1);
const serializeWeight = serializeFixnum(1);

const parts = new Relvar([
  { name: 'PNO', type: isPNO },
  { name: 'PNAME', type: String },
  { name: 'COLOR', type: isColor, default: 'Green' },
  { name: 'WEIGHT', type: isWeight, serialize: serializeWeight },
  { name: 'CITY', type: String }
]);

// works:
parts.add(new Map([
  ['PNO', 'P1'],
  // attributes can be out of order relative to heading
  ['color', 'Red'],
  ['PName', 'Nut'],
  ['WEIGHT', 12.0], // value objects don't have to be strings
  ['city', 'London']
]));

// also works:
parts.add(new Map([
  ['PNO', 'P2'],
  ['PNAME', 'Bolt'],
  // color is defaulted
  ['WEIGHT', '17.0'],
  ['CITY', 'Paris']
]));

// doesn't work:
try {
  parts.add(new Map([
    // missing PNO
    ['PNAME', 'Screw'],
    ['COLOR', 'Blue'],
    ['WEIGHT', '17.0'],
    ['CITY', 'Oslo']
  ]));
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
  ]));
} catch (e) {
  console.warn('still not a good idea:', e.message)
}

let totalWeight = 0;
// uses iteration protocol
for (let tuple of parts) totalWeight += tuple.get('WEIGHT')

console.log('Total weight of parts is:', totalWeight)
assert(totalWeight === 29)
```

Some things to note in this example:
- Attribute names aren't case sensitive, either in the heading
  definition or when fetching values from a tuple.
- Both the heading and entry tuples are unordered sets; on the down
  side, this means that every value must be explicitly named, but on the
  up side, there's no need to remember what order attributes need to go
  in.
- The heading is passed to the relvar constructor as an [iterable][]
  list of option objects. More on their structure below.
- Unlike SQL schemas, values are _not nullable_ in relvars.
- The body is also an [iterable][] set of tuples (implemented as Maps).
- It is safe to use the values of each tuple key as their intended type
  because they're validated on addition.
- Validators and serializers _must be self-contained, serializable
  functions_. This is because the heading should be itself serializable
  into an RDBMS's data dictionary.

### heading

Stored on the produced relvar as `relvar.heading`.

#### `name`

Any valid JavaScript string. As a convenience, case is ignored both on
definition and access; all strings are UTF-8 and will be case-folded
according to the rules of the locale of the current JS environment
(TODO: allow the locale to be defined on the relvar).

#### `type`

A function that, given a string, returns whether the string can be
interpreted as a valid member of the type's domain. Returns `true` or
`false`, or throws a `TypeError` with a more descriptive validation
failure message. NOTE: all errors except TypeErrors will be rethrown.

Type-validation functions must be simple functions with no variables
included from an enclosing lexical scope. Type validators may be
serialized into a data dictionary. Note that object wrappers for
JavaScript's built-in value objects (Strings, Numbers, etc) can be used
directly.

#### `serialize`

An object containing a pair of `{ read, write }` functions to serialize
and deserialize an object. `read` and `write` must both be simple
functions, as with `type` functions above (and for the same reason).

`write` is called indirectly when `toJSON()` is called on a tuple entry.
`read` is called whenever a value is added (relvars always assume that
attribute values start as strings).

`read` and `write` are invoked with the value to be de/serialized and
the `type` function so that they can ensure they're being given valid
values.

#### `default`

The default value for an attribute. This value will be matched against
the attribute's `type` function.

## design notes

### testing with Babel

I've always placed a high value on backwards compatibility.

- At New Relic, we stipulated that as tooling vendors we had little control
  over what versions of Node.js our customers were running into production. For
  a while, at least one large potential customer had important services running
  under Node 0.6.
- At npm, it's more important to the project that users be running a current
  npm than a recent version of Node, so for the sake of ops teams running
  legacy Node, we supported all the way back to 0.8 until very recently.

At the same time, I really like using new JavaScript features, and I'd really
like to use those features in my tests. I use [`tap`][] to write tests, because
[@isaacs][] is thoughtful about developer UX, and he and [@bcoe][] have put
considerable work into choosing a useful set of features, including coverage,
and semi-automatic reporting of coverage information.

A feature that [`tap`][] _doesn't_ include is support for working
with transpilers. There are some [complicated setups][tap with Babel]
that will make this work, but I decided to try something new. Instead
of having a potentially-transpiled set of ES code under `test/`, I'm
putting the ES 2015 version of the tests in `src/tap`. That way, they'll
be transpiled with the rest of the source, and can then be run with `tap
lib/tap/*.js` and no further ceremony.

[@bcoe]: https://github.com/bcoe
[@isaacs]: https://github.com/isaacs
[_The New Relational Database Dictionary_]: http://shop.oreilly.com/product/0636920048497.do
[`tap`]: https://node-tap.org/
[CJ Date]: https://en.wikipedia.org/wiki/Christopher_J._Date
[iterable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
[relvar]: https://en.wikipedia.org/wiki/Relvar
[tap with Babel]: https://remysharp.com/2016/05/02/faster-tests-for-multi-node-code-with-es6-and-babel

import { readFileSync, writeFileSync } from 'node:fs'

const path = 'supabase/migrations/20260803070000_c1b_game_catalogue_memberships.sql'
let sql = readFileSync(path, 'utf8')

const opening = /\nas \$\n/g
const closing = /\n\$;\n/g
const openingCount = [...sql.matchAll(opening)].length
const closingCount = [...sql.matchAll(closing)].length

if (openingCount !== 3 || closingCount !== 3) {
  throw new Error(`Expected exactly three collapsed opening and closing delimiters; found ${openingCount}/${closingCount}`)
}

sql = sql.replace(opening, '\nas $$$$\n')
sql = sql.replace(closing, '\n$$$$;\n')

if (/\nas \$\n/.test(sql) || /\n\$;\n/.test(sql)) {
  throw new Error('Collapsed dollar quote remains after repair')
}

writeFileSync(path, sql)
writeFileSync('.c1b-dollar-quote-repair-applied', 'applied\n')
console.log('Repaired exactly three PL/pgSQL dollar-quote pairs.')

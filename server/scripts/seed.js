// Loads example data into DATABASE_URL, or removes it again.
//   npm run db:seed          add example devices, employees and handouts
//   npm run db:seed:remove   delete them, leaving real data untouched
import { loadEnvFile, readConfig } from '../src/config.js'
import { createPostgresDb, sslConfigFrom } from '../src/db/postgres.js'
import { removeExampleData, seedExampleData } from '../src/db/exampleData.js'

loadEnvFile()
let config
try {
  config = readConfig(process.env, { needAuth: false })
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

const db = createPostgresDb({
  connectionString: config.databaseUrl,
  ssl: sslConfigFrom(process.env, config.databaseUrl),
})

try {
  if (process.argv.includes('--remove')) {
    const removed = await removeExampleData(db)
    if (removed.devices + removed.employees === 0) {
      console.log('No example data found - nothing to remove.')
    } else {
      console.log(`Removed example data: ${removed.devices} devices, ${removed.employees} employees, ` +
        `${removed.handouts} handouts, ${removed.departments} departments.`)
      if (removed.yourHandouts > 0) {
        console.log(`Also removed ${removed.yourHandouts} handout(s) you recorded that involved ` +
          'an example device or employee.')
      }
    }
  } else {
    const result = await seedExampleData(db)
    if (result.status === 'already-loaded') {
      console.log('Example data is already loaded. To remove it: npm run db:seed:remove')
    } else if (result.status === 'clash') {
      console.error('Nothing was loaded. These records already exist in your database and ' +
        'clash with the example data:')
      for (const c of result.clashes) console.error(`  ${c.kind}: ${c.label}`)
      process.exitCode = 1
    } else {
      console.log(`Loaded example data: ${result.devices} devices, ${result.employees} employees, ` +
        `${result.handouts} handouts, ${result.departments} departments.`)
      console.log('Remove it before entering real data: npm run db:seed:remove')
    }
  }
} catch (err) {
  console.error(err.code === '42P01'
    ? 'The tables do not exist yet. Run: npm run db:migrate'
    : err.message)
  process.exitCode = 1
} finally {
  await db.close()
}

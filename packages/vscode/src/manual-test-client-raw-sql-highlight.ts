/* eslint-disable */
// @ts-nocheck
async function main() {
  // How to use?
  // - Launch VS Code extension
  // - Open this file
  // - Check visually that highligting works
  const db: any
  const raw: any
  const sql: any
  const join: any
  const empty: any

  // $queryRaw to return actual records (for example, using SELECT)
  // $executeRaw to return a count of affected rows (for example, after an UPDATE or DELETE)
  // $queryRawUnsafe to return actual records (for example, using SELECT) using a raw string. Potential SQL injection risk
  // $executeRawUnsafe to return a count of affected rows (for example, after an UPDATE or DELETE) using a raw string. Potential SQL injection risk

  /*
   * Working
   */

  // Test queryRaw`string`
  const result = await prisma.$queryRaw`select * FROM User`
  // Test queryRaw`string` multiline
  const result = await prisma.$queryRaw`
      select * FROM User 
        WHERE firstname = 'Alice'
          AND somenumber = 1`
  // Test queryRaw<type>`string`
  const result = await prisma.$queryRaw<User[]>`SELECT * FROM User`
  // Test .$queryRaw`` with ${param}
  const queryRawTemplateWithParams = await db.$queryRaw`SELECT * FROM User WHERE name = ${'Alice'} OR city = ${city}`
  // Test .$executeRaw`` with ${param}
  const $executeRawTemplate = await db.$executeRaw`UPDATE User SET name = ${'name'} WHERE id = ${id}`

  /*
   * Not working
   */

  const result = await prisma.$queryRaw(`SELECT * FROM User`)
  const result = await prisma.$queryRaw('SELECT * FROM User')
  const result = await prisma.$queryRaw('SELECT * FROM User')
  const result = await prisma.$queryRaw<User[]>(`SELECT * FROM User`)
  const result = await prisma.$queryRaw<User[]>('SELECT * FROM User')
  const result = await prisma.$queryRaw<User[]>('SELECT * FROM User')

  const test = /* sql */ `SELECT * FROM`
  sql`SELECT * FROM User`
  const test = `SELECT * FROM User`

  // Test queryRaw(string)
  const queryRaw = await db.$queryRawUnsafe('SELECT 1')

  // Test queryRaw(string, values)
  const queryRawWithValues = await db.$queryRawUnsafe('SELECT $1 AS name, $2 AS id', 'Alice', 42)

  // Test queryRaw`` with prisma.sql``
  const queryRawTemplateFromSqlTemplate = await db.$queryRaw(
    sql`
      SELECT ${join([raw('email'), raw('id'), raw('name')])}
      FROM ${raw('User')}
      ${sql`WHERE name = ${'Alice'}`}
      ${empty}
    `,
  )

  // Test .$executeRaw(string)
  const executeRaw = await db.$executeRawUnsafe('UPDATE User SET name = $1 WHERE id = $2', 'name', 'id')

  // Test .$executeRaw(string, values)
  const executeRawWithValues = await db.$executeRawUnsafe('UPDATE User SET name = $1 WHERE id = $2', 'Alice', 'id')
}

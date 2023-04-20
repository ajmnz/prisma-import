import * as assert from 'assert'
import { handleDocumentFormatting } from '../MessageHandler'
import { getFileUrl, getTextDocument } from './helper'
import { setSchemasAndBlocksFromURIs } from '../imports'

suite('Imports', () => {
  suite('Formatting', () => {
    test('Should leave only one trailing newline', () => {
      const noTrailingFixture = './imports/no-trailing.prisma'
      const manyTrailingFixture = './imports/many-trailing.prisma'

      const noTrailingDoc = getTextDocument(noTrailingFixture, true)
      const manyTrailingDoc = getTextDocument(manyTrailingFixture, true)

      setSchemasAndBlocksFromURIs(
        [getFileUrl(noTrailingFixture), getFileUrl(manyTrailingFixture)],
        [noTrailingDoc, manyTrailingDoc],
      )

      let noTrailingFlag = false
      let manyTrailingFlag = false

      const noTrailingFormatted = handleDocumentFormatting(
        { textDocument: { uri: getFileUrl(noTrailingFixture) }, options: { tabSize: 2, insertSpaces: true } },
        noTrailingDoc,
        () => {
          noTrailingFlag = true
          return Promise.resolve()
        },
      )

      const manyTrailingFormatted = handleDocumentFormatting(
        { textDocument: { uri: getFileUrl(manyTrailingFixture) }, options: { tabSize: 2, insertSpaces: true } },
        manyTrailingDoc,
        () => {
          manyTrailingFlag = true
          return Promise.resolve()
        },
      )

      assert.strictEqual(
        noTrailingFormatted[0].newText,
        'import { CompanyDetails } from "./many-trailing"\n\nmodel Company {\n  id      String          @id\n  name    String\n  slug    String          @unique\n  details CompanyDetails?\n}\n',
      )

      assert.strictEqual(
        manyTrailingFormatted[0].newText,
        'import { Company } from "./no-trailing"\n\nmodel CompanyDetails {\n  companyId String  @id\n  shortBio  String\n  company   Company @relation(fields: [companyId], references: [id])\n}\n',
      )

      assert.ok(!noTrailingFlag)
      assert.ok(!manyTrailingFlag)
    })
  })
})

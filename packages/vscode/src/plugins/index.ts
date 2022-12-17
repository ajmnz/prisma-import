import languageServer from './prisma-language-server'
import { PrismaVSCodePlugin } from './types'

const plugins: PrismaVSCodePlugin[] = [languageServer]

export default plugins

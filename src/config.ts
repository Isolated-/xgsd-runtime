import * as fs from 'fs-extra'
import * as path from 'path'

export function getPackageVersion(input: string): string {
  try {
    const pkgPath = resolvePackageJson(input)
    const json = fs.readJsonSync(pkgPath)

    if (!json?.version || typeof json.version !== 'string') {
      return 'unknown'
    }

    return `${json.version}`
  } catch (err: any) {
    return 'unknown'
  }
}

function resolvePackageJson(input: string): string {
  try {
    return require.resolve(`${input}/package.json`, {
      paths: [process.cwd()],
    })
  } catch {
    try {
      const entry = require.resolve(input, {
        paths: [process.cwd()],
      })

      let dir = path.dirname(entry)

      while (dir !== path.dirname(dir)) {
        const candidate = path.join(dir, 'package.json')
        if (fs.pathExistsSync(candidate)) return candidate
        dir = path.dirname(dir)
      }

      throw new Error(`package.json not found for ${input}`)
    } catch (err: any) {
      throw new Error(`Cannot resolve package.json for "${input}"`)
    }
  }
}

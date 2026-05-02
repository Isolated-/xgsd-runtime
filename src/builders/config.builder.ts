import {pathExistsSync, readFileSync, readJsonSync} from 'fs-extra'
import {ProjectConfig} from '../types/config.types'
import * as yaml from 'yaml'

export class ConfigBuilderLoadStage {
  constructor(private readonly input: string | ProjectConfig) {}

  load() {
    if (typeof this.input === 'object') {
      return new ConfigBuilderParseStage(this.input)
    }

    const filePath = this.input

    if (!pathExistsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`)
    }

    const content = readFileSync(filePath, 'utf-8')
    return new ConfigBuilderParseStage(content)
  }
}

export class ConfigBuilderParseStage {
  constructor(private readonly _raw: string | Record<string, unknown>) {}

  parse() {
    let parsed: any
    if (typeof this._raw === 'object') {
      parsed = this._raw
      return new ConfigBuilderValidateStage(parsed)
    }

    const raw = String(this._raw).trim()

    // try JSON first
    try {
      parsed = JSON.parse(raw)
      return new ConfigBuilderValidateStage(parsed)
    } catch {}

    // fallback YAML
    parsed = yaml.parse(raw)
    return new ConfigBuilderValidateStage(parsed)
  }
}
export class ConfigBuilderValidateStage {
  constructor(private _partial: Partial<ProjectConfig>) {}

  validate(validator?: (input: any) => ProjectConfig) {
    try {
      let config: any
      if (validator) {
        config = validator(this._partial)
      } else {
        config = this._partial
      }

      return new ConfigBuilderBuildStage(config)
    } catch (err: any) {
      throw err
    }
  }
}

export class ConfigBuilderBuildStage {
  constructor(private _config: Partial<ProjectConfig>) {}

  defaultFromPackageJson(packagePath: string): this {
    if (!pathExistsSync(packagePath)) {
      throw new Error('package path does not exist')
    }

    const json = readJsonSync(packagePath)

    this._config.name = this._config.name ?? json.name
    this._config.description = this._config.description ?? json.description
    this._config.version = this._config.version ?? json.version
    this._config.entry = this._config.entry ?? json.main

    return this
  }

  build(): ProjectConfig {
    return this._config
  }
}

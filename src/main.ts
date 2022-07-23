import * as core from '@actions/core'
import * as glob from '@actions/glob'
import {initialise} from './spellcheck'
import {readFileSync} from 'fs'

async function run(): Promise<void> {
  try {
    const spell = await initialise()

    const globs = await glob.create(core.getInput('files-to-check'))
    const ignoreFile = core.getInput('words-to-ignore-file')

    const ignores = new Set<string>()

    if (ignoreFile !== '') {
      const ignoreEntries = readFileSync(ignoreFile, {encoding: 'utf8'}).split(
        '\n'
      )

      for (const entry of ignoreEntries) {
        ignores.add(entry.trim().toLowerCase())
      }
    }

    core.info(`Ignoring words: ${Array.from(ignores)}`)

    let hasMisspelled = false

    for await (const file of globs.globGenerator()) {
      const contents = readFileSync(file, {encoding: 'utf8'})

      for await (const result of spell.check(contents)) {
        if (ignores.has(result.word.toLowerCase())) {
          continue
        }

        hasMisspelled = true

        const suggestions = result.suggestions.map(s => `"${s}"`).join(', ')
        core.error(
          `Misspelled word "${result.word}".\nSuggestions: ${suggestions}`,
          {
            title: 'Misspelled word',
            file,
            startLine: result.position.start.line,
            startColumn: result.position.start.column,
            endLine: result.position.end.line,
            endColumn: result.position.end.column
          }
        )
      }

      core.info(`Spellchecked ${file}`)
    }

    if (hasMisspelled) {
      core.setFailed('Misspelled word(s)')
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()

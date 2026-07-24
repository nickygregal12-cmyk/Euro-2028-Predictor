import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

describe('EditorConfig baseline', () => {
  it('keeps the repository-wide text rules explicit', () => {
    const editorConfig = readRepositoryFile('.editorconfig')

    expect(editorConfig).toContain('root = true')
    expect(editorConfig).toMatch(/\[\*\][\s\S]*charset = utf-8/)
    expect(editorConfig).toMatch(/\[\*\][\s\S]*end_of_line = lf/)
    expect(editorConfig).toMatch(/\[\*\][\s\S]*insert_final_newline = true/)
    expect(editorConfig).toMatch(/\[\*\][\s\S]*trim_trailing_whitespace = true/)
    expect(editorConfig).toMatch(/\[\*\][\s\S]*indent_style = space/)
    expect(editorConfig).toMatch(/\[\*\][\s\S]*indent_size = 2/)
    expect(editorConfig).toMatch(/\[\*\.md\][\s\S]*trim_trailing_whitespace = false/)
    expect(editorConfig).toMatch(/\[Makefile\][\s\S]*indent_style = tab/)
  })
})

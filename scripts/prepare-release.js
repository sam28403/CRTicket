import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const tag = process.env.RELEASE_TAG
if (!tag || !/^v\d+(?:[.-]\d+)*$/.test(tag)) {
  throw new Error('RELEASE_TAG 必须是 v 开头的版本标签，例如 v261024')
}

const version = tag.slice(1)
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
if (packageJson.version !== version) {
  throw new Error(`标签 ${tag} 与 package.json 版本 ${packageJson.version} 不一致`)
}

const directory = 'src/content/changelog'
const matches = []
for (const file of await readdir(directory)) {
  if (!file.endsWith('.md')) continue

  const content = (await readFile(path.join(directory, file), 'utf8'))
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim()
  const heading = content.match(/^#\s+(\S+)\s*$/m)?.[1]
  if (heading === version || heading === tag) {
    matches.push({ file, content })
  }
}

if (matches.length !== 1) {
  throw new Error(`版本 ${tag} 必须对应一份 changelog，当前找到 ${matches.length} 份`)
}

await mkdir('release-files', { recursive: true })
await writeFile('release-files/title.txt', `${tag}\n`)
await writeFile('release-files/changelog.md', `${matches[0].content}\n`)
console.log(`Release 标题：${tag}，正文来源：${directory}/${matches[0].file}`)

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `# Release 预览：${tag}\n\n${matches[0].content}\n\n`
      + '发布审批通过后，将在正文下方追加自动生成的 Release notes。\n',
  )
}

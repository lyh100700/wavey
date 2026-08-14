/**
 * APK에 서명할 열쇠(키스토어)를 만든다.
 *
 *   node scripts/make-keystore.mjs
 *
 * ── 왜 필요한가 ──
 *
 * 안드로이드는 앱마다 서명을 확인해서, 서명이 다르면 "다른 앱"으로 본다.
 * 그래서 서명이 바뀌면 기존 앱 위에 덮어 설치할 수 없고 지웠다 깔아야 한다.
 * 지우면 저장해 둔 곡 목록도 함께 날아간다.
 *
 * 그런데 서명 설정을 해 두지 않으면 안드로이드 빌드 도구가 임시 열쇠를 그때그때
 * 만들어 쓴다. GitHub의 빌드 서버는 매번 깨끗한 상태로 시작하므로 빌드마다
 * 다른 열쇠가 만들어지고, 그래서 업데이트가 안 됐다.
 *
 * 이 스크립트로 열쇠를 한 번 만들어 GitHub 비밀값으로 넣어 두면, 앞으로 모든
 * 빌드가 같은 열쇠로 서명되어 덮어 설치가 된다.
 *
 * ── 주의 ──
 *
 * 만들어진 파일은 저장소에 올리지 않는다(.gitignore에 넣어 뒀다). 저장소가
 * 공개라서 올리면 누구나 이 앱인 척하는 파일을 만들 수 있다.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import forge from 'node-forge'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'wavey-signing.p12')
const ALIAS = 'wavey'
const YEARS = 30

if (existsSync(OUT)) {
  console.error(`이미 ${OUT} 이 있다.`)
  console.error('새로 만들면 기존 열쇠와 달라져서 또 덮어 설치가 안 된다.')
  console.error('정말 새로 만들 거라면 파일을 직접 지우고 다시 실행할 것.')
  process.exit(1)
}

/** 사람이 외울 필요 없는 긴 무작위 암호. */
function makePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = forge.random.getBytesSync(32)
  let out = ''
  for (let i = 0; i < 32; i += 1) {
    out += alphabet[bytes.charCodeAt(i) % alphabet.length]
  }
  return out
}

console.log('열쇠 만드는 중… (2048비트라 몇 초 걸린다)')

const keys = forge.pki.rsa.generateKeyPair(2048)
const cert = forge.pki.createCertificate()

cert.publicKey = keys.publicKey
cert.serialNumber = `00${forge.util.bytesToHex(forge.random.getBytesSync(8))}`
cert.validity.notBefore = new Date()
cert.validity.notAfter = new Date()
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + YEARS)

const subject = [
  { name: 'commonName', value: 'Wavey' },
  { name: 'organizationName', value: 'Wavey' },
  { name: 'countryName', value: 'KR' },
]
cert.setSubject(subject)
cert.setIssuer(subject) // 스스로 보증하는 인증서
cert.sign(keys.privateKey, forge.md.sha256.create())

const password = makePassword()
const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
  friendlyName: ALIAS,
  algorithm: '3des', // 자바가 확실히 읽는 방식
})
const der = forge.asn1.toDer(p12).getBytes()

// 만들자마자 다시 열어 본다. 열리지 않는 파일을 GitHub에 올리면
// 빌드가 깨진 뒤에야 알게 된다.
const check = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), password)
const bags = check.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
if (!bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.length) {
  console.error('만든 열쇠를 다시 열지 못했다. 중단한다.')
  process.exit(1)
}

writeFileSync(OUT, Buffer.from(der, 'binary'))

const base64 = Buffer.from(der, 'binary').toString('base64')
writeFileSync(join(root, '.keystore-base64.txt'), base64)

// 암호는 화면에 찍지 않는다. 터미널 기록이나 대화에 남으면 비밀이 아니게 된다.
writeFileSync(join(root, '.keystore-password.txt'), password)

console.log(`
만들었다.

  파일   : wavey-signing.p12
  별칭   : ${ALIAS}
  유효기간: ${YEARS}년

GitHub 비밀값 두 개를 넣어야 한다. 등록할 곳:
  https://github.com/lyh100700/wavey/settings/secrets/actions/new

  1) Name: ANDROID_KEYSTORE_BASE64
     아래 명령으로 값을 복사한 뒤 붙여넣기
       cat .keystore-base64.txt | pbcopy

  2) Name: ANDROID_KEYSTORE_PASSWORD
     아래 명령으로 값을 복사한 뒤 붙여넣기
       tr -d '\\n' < .keystore-password.txt | pbcopy

암호는 화면에 찍지 않았다. .keystore-password.txt 에만 들어 있고
저장소에는 올라가지 않는다. 이 파일을 잃어버리면 열쇠를 새로 만들어야 하고,
그러면 한 번은 앱을 지웠다 깔아야 한다.
`)

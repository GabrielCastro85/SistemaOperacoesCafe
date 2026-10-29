import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

const execFileAsync = promisify(execFile);
const distributionUrl = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const eventUrl = "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";

const ufAuthorCodes: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53",
  ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
  PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43",
  RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17"
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true
});

const powerShellBridge = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$payloadText = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:OPERACOES_CAFE_SEFAZ_INPUT))
$payload = $payloadText | ConvertFrom-Json

function Get-InstalledCertificates {
  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new([System.Security.Cryptography.X509Certificates.StoreName]::My, [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser)
  $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
  try { return @($store.Certificates | ForEach-Object { [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($_) }) }
  finally { $store.Close() }
}

function Get-SefazCertificate([string]$cnpj) {
  $digits = $cnpj -replace '\D', ''
  $base = $digits.Substring(0, 8)
  $valid = @(Get-InstalledCertificates | Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) })
  $exact = @($valid | Where-Object { $_.Subject -match (':' + [regex]::Escape($digits) + '(,|$)') } | Sort-Object NotAfter -Descending | Select-Object -First 1)
  if ($exact.Count -gt 0) { return $exact[0] }
  $sameBase = @($valid | Where-Object { $_.Subject -match (':' + [regex]::Escape($base) + '\d{6}(,|$)') } | Sort-Object NotAfter -Descending | Select-Object -First 1)
  if ($sameBase.Count -gt 0) { return $sameBase[0] }
  throw "Nenhum certificado A1 valido com chave privada foi encontrado para o CNPJ $digits."
}

function Invoke-SefazSoap([string]$url, [string]$body, $cert) {
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $null = $handler.ClientCertificates.Add($cert)
  $handler.SslProtocols = [System.Security.Authentication.SslProtocols]::Tls12
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(60)
  try {
    $content = [System.Net.Http.StringContent]::new($body, [System.Text.Encoding]::UTF8, 'application/soap+xml')
    $response = $client.PostAsync($url, $content).GetAwaiter().GetResult()
    $responseText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) { throw "SEFAZ respondeu HTTP $([int]$response.StatusCode): $responseText" }
    return $responseText
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }
}

if ($payload.operation -eq 'LIST_CERTIFICATES') {
  $certificates = @(Get-InstalledCertificates | Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } | ForEach-Object {
    [pscustomobject]@{ subject = $_.Subject; thumbprint = $_.Thumbprint; notAfter = $_.NotAfter.ToUniversalTime().ToString('o') }
  })
  [pscustomobject]@{ certificates = $certificates } | ConvertTo-Json -Depth 4 -Compress
  exit 0
}

$cert = Get-SefazCertificate $payload.cnpj
if ($payload.operation -eq 'DISTRIBUTION') {
  $query = if ($payload.accessKey) {
    "<consChNFe><chNFe>$($payload.accessKey)</chNFe></consChNFe>"
  } else {
    "<distNSU><ultNSU>$($payload.lastNsu)</ultNSU></distNSU>"
  }
  $request = '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>' +
    '<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>' +
    '<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>1</tpAmb><cUFAutor>' + $payload.ufCode + '</cUFAutor><CNPJ>' + $payload.cnpj + '</CNPJ>' + $query + '</distDFeInt>' +
    '</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>'
  $responseText = Invoke-SefazSoap '${distributionUrl}' $request $cert
  [pscustomobject]@{ bodyBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($responseText)); certificateSubject = $cert.Subject; certificateNotAfter = $cert.NotAfter.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress
  exit 0
}

if ($payload.operation -eq 'ACKNOWLEDGE') {
  Add-Type -AssemblyName System.Security
  $now = [DateTimeOffset]::Now.ToString('yyyy-MM-ddTHH:mm:sszzz')
  $eventId = 'ID210210' + $payload.accessKey + '01'
  $eventXml = '<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>' + ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()) + '</idLote><evento versao="1.00"><infEvento Id="' + $eventId + '"><cOrgao>91</cOrgao><tpAmb>1</tpAmb><CNPJ>' + $payload.cnpj + '</CNPJ><chNFe>' + $payload.accessKey + '</chNFe><dhEvento>' + $now + '</dhEvento><tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento></envEvento>'
  $document = [System.Xml.XmlDocument]::new()
  $document.PreserveWhitespace = $true
  $document.LoadXml($eventXml)
  $eventNode = $document.SelectSingleNode("/*[local-name()='envEvento']/*[local-name()='evento']")
  $signedXml = [System.Security.Cryptography.Xml.SignedXml]::new($eventNode)
  $signedXml.SigningKey = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
  $signedXml.SignedInfo.CanonicalizationMethod = [System.Security.Cryptography.Xml.SignedXml]::XmlDsigC14NTransformUrl
  $signedXml.SignedInfo.SignatureMethod = [System.Security.Cryptography.Xml.SignedXml]::XmlDsigRSASHA1Url
  $reference = [System.Security.Cryptography.Xml.Reference]::new()
  $reference.Uri = '#' + $eventId
  $reference.DigestMethod = [System.Security.Cryptography.Xml.SignedXml]::XmlDsigSHA1Url
  $reference.AddTransform([System.Security.Cryptography.Xml.XmlDsigEnvelopedSignatureTransform]::new())
  $reference.AddTransform([System.Security.Cryptography.Xml.XmlDsigC14NTransform]::new())
  $signedXml.AddReference($reference)
  $keyInfo = [System.Security.Cryptography.Xml.KeyInfo]::new()
  $keyInfo.AddClause([System.Security.Cryptography.Xml.KeyInfoX509Data]::new($cert))
  $signedXml.KeyInfo = $keyInfo
  $signedXml.ComputeSignature()
  $signatureNode = $document.ImportNode($signedXml.GetXml(), $true)
  $null = $eventNode.AppendChild($signatureNode)
  $request = '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>' +
    '<nfeRecepcaoEvento xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><nfeDadosMsg>' + $document.OuterXml + '</nfeDadosMsg></nfeRecepcaoEvento></soap12:Body></soap12:Envelope>'
  $responseText = Invoke-SefazSoap '${eventUrl}' $request $cert
  [pscustomobject]@{ bodyBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($responseText)); certificateSubject = $cert.Subject; certificateNotAfter = $cert.NotAfter.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress
  exit 0
}

throw "Operacao SEFAZ desconhecida."
`;

export interface SefazCertificateInfo {
  subject: string;
  thumbprint: string;
  notAfter: string;
  matchingCnpj: string | null;
}

export interface SefazNfeSummary {
  accessKey: string;
  issuerCnpj: string | null;
  issuerName: string | null;
  issuedAt: string | null;
  receivedAt: string | null;
  totalAmount: string | null;
  situationCode: string | null;
  nsu: string;
  schema: string;
  hasFullXml: boolean;
}

export interface SefazDistributionDocument {
  nsu: string;
  schema: string;
  xml: string;
  summary: SefazNfeSummary | null;
  isNfeXml: boolean;
}

export interface SefazDistributionResponse {
  statusCode: string;
  reason: string;
  responseAt: string | null;
  lastNsu: string;
  maxNsu: string;
  certificateSubject: string;
  certificateNotAfter: string;
  documents: SefazDistributionDocument[];
}

export interface SefazAcknowledgementResponse {
  statusCode: string;
  reason: string;
  protocol: string | null;
  registeredAt: string | null;
}

export async function listInstalledSefazCertificates(): Promise<SefazCertificateInfo[]> {
  const response = await runPowerShell({ operation: "LIST_CERTIFICATES" });
  const certificates = Array.isArray(response.certificates) ? response.certificates : response.certificates ? [response.certificates] : [];
  return certificates.map((certificate: Record<string, unknown>) => {
    const subject = String(certificate.subject ?? "");
    return {
      subject,
      thumbprint: String(certificate.thumbprint ?? ""),
      notAfter: String(certificate.notAfter ?? ""),
      matchingCnpj: subject.match(/:(\d{14})(?:,|$)/)?.[1] ?? null
    };
  });
}

export async function querySefazDistribution(input: { cnpj: string; state: string; lastNsu?: string; accessKey?: string }): Promise<SefazDistributionResponse> {
  const cnpj = digits(input.cnpj, 14, "CNPJ");
  const state = input.state.trim().toUpperCase();
  const ufCode = ufAuthorCodes[state];
  if (!ufCode) throw new Error(`UF ${state || "nao informada"} nao suportada para consulta da SEFAZ.`);
  const accessKey = input.accessKey ? digits(input.accessKey, 44, "chave de acesso") : undefined;
  const lastNsu = normalizeNsu(input.lastNsu ?? "0");
  const response = await runPowerShell({ operation: "DISTRIBUTION", cnpj, ufCode, lastNsu, accessKey });
  const soap = decodeBase64(String(response.bodyBase64 ?? ""));
  return parseSefazDistributionSoap(soap, {
    fallbackLastNsu: lastNsu,
    certificateSubject: String(response.certificateSubject ?? ""),
    certificateNotAfter: String(response.certificateNotAfter ?? "")
  });
}

export function parseSefazDistributionSoap(soap: string, metadata: { fallbackLastNsu: string; certificateSubject: string; certificateNotAfter: string }): SefazDistributionResponse {
  const parsed = parser.parse(soap) as Record<string, unknown>;
  const result = findObjectByKey(parsed, "retDistDFeInt");
  if (!result) throw new Error("A resposta da SEFAZ nao contem retDistDFeInt.");
  const documents = normalizeArray(result.loteDistDFeInt && asRecord(result.loteDistDFeInt)?.docZip)
    .map((entry) => parseDistributedDocument(asRecord(entry)))
    .filter((entry): entry is SefazDistributionDocument => entry !== null);
  return {
    statusCode: text(result.cStat),
    reason: text(result.xMotivo),
    responseAt: nullableText(result.dhResp),
    lastNsu: normalizeNsu(text(result.ultNSU) || metadata.fallbackLastNsu),
    maxNsu: normalizeNsu(text(result.maxNSU) || metadata.fallbackLastNsu),
    certificateSubject: metadata.certificateSubject,
    certificateNotAfter: metadata.certificateNotAfter,
    documents
  };
}

export async function acknowledgeSefazNfe(input: { cnpj: string; accessKey: string }): Promise<SefazAcknowledgementResponse> {
  const cnpj = digits(input.cnpj, 14, "CNPJ");
  const accessKey = digits(input.accessKey, 44, "chave de acesso");
  const response = await runPowerShell({ operation: "ACKNOWLEDGE", cnpj, accessKey });
  const soap = decodeBase64(String(response.bodyBase64 ?? ""));
  const parsed = parser.parse(soap) as Record<string, unknown>;
  const eventResult = findObjectByKey(parsed, "infEvento") ?? findObjectByKey(parsed, "retEnvEvento");
  if (!eventResult) throw new Error("A resposta da SEFAZ nao contem o resultado da Ciencia da Operacao.");
  return {
    statusCode: text(eventResult.cStat),
    reason: text(eventResult.xMotivo),
    protocol: nullableText(eventResult.nProt),
    registeredAt: nullableText(eventResult.dhRegEvento)
  };
}

function parseDistributedDocument(entry: Record<string, unknown> | null): SefazDistributionDocument | null {
  if (!entry) return null;
  const compressed = text(entry["#text"] ?? entry.docZip ?? entry);
  if (!compressed) return null;
  const xml = gunzipSync(Buffer.from(compressed, "base64")).toString("utf8");
  const schema = text(entry["@_schema"]);
  const nsu = normalizeNsu(text(entry["@_NSU"]));
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const summaryRoot = findObjectByKey(parsed, "resNFe");
  const fullNfe = Boolean(findObjectByKey(parsed, "nfeProc") || findObjectByKey(parsed, "NFe"));
  const accessKey = summaryRoot ? text(summaryRoot.chNFe) : extractAccessKeyFromNfe(parsed);
  const summary = accessKey ? {
    accessKey,
    issuerCnpj: summaryRoot ? nullableText(summaryRoot.CNPJ ?? summaryRoot.CPF) : extractIssuerCnpj(parsed),
    issuerName: summaryRoot ? nullableText(summaryRoot.xNome) : extractIssuerName(parsed),
    issuedAt: summaryRoot ? nullableText(summaryRoot.dhEmi) : extractIssueDate(parsed),
    receivedAt: summaryRoot ? nullableText(summaryRoot.dhRecbto) : null,
    totalAmount: summaryRoot ? nullableText(summaryRoot.vNF) : extractTotalAmount(parsed),
    situationCode: summaryRoot ? nullableText(summaryRoot.cSitNFe) : "1",
    nsu,
    schema,
    hasFullXml: fullNfe
  } satisfies SefazNfeSummary : null;
  return { nsu, schema, xml, summary, isNfeXml: fullNfe };
}

function extractAccessKeyFromNfe(parsed: Record<string, unknown>): string | null {
  const infNfe = findObjectByKey(parsed, "infNFe");
  const id = text(infNfe?.["@_Id"]);
  return id.replace(/^NFe/, "") || null;
}

function extractIssuerCnpj(parsed: Record<string, unknown>): string | null {
  return nullableText(findObjectByKey(parsed, "emit")?.CNPJ ?? findObjectByKey(parsed, "emit")?.CPF);
}

function extractIssuerName(parsed: Record<string, unknown>): string | null {
  return nullableText(findObjectByKey(parsed, "emit")?.xNome);
}

function extractIssueDate(parsed: Record<string, unknown>): string | null {
  const ide = findObjectByKey(parsed, "ide");
  return nullableText(ide?.dhEmi ?? ide?.dEmi);
}

function extractTotalAmount(parsed: Record<string, unknown>): string | null {
  return nullableText(findObjectByKey(parsed, "ICMSTot")?.vNF);
}

function findObjectByKey(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findObjectByKey(item, key);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record[key] && typeof record[key] === "object") return asRecord(record[key]);
  for (const nested of Object.values(record)) {
    const found = findObjectByKey(nested, key);
    if (found) return found;
  }
  return null;
}

async function runPowerShell(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (process.platform !== "win32") throw new Error("A consulta direta da SEFAZ esta disponivel somente no Windows.");
  const encodedCommand = Buffer.from(powerShellBridge, "utf16le").toString("base64");
  const encodedInput = Buffer.from(JSON.stringify(input), "utf8").toString("base64");
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodedCommand], {
      windowsHide: true,
      timeout: 90_000,
      maxBuffer: 25 * 1024 * 1024,
      env: { ...process.env, OPERACOES_CAFE_SEFAZ_INPUT: encodedInput }
    });
    const output = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (!output) throw new Error("A ponte do certificado nao retornou dados.");
    return JSON.parse(output) as Record<string, unknown>;
  } catch (error) {
    const detail = error && typeof error === "object" && "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "").trim() : "";
    throw new Error(detail || (error instanceof Error ? error.message : "Falha ao acessar o certificado do Windows."));
  }
}

function digits(value: string, length: number, label: string): string {
  const normalized = value.replace(/\D/g, "");
  if (normalized.length !== length) throw new Error(`${label} deve ter ${length} digitos.`);
  return normalized;
}

function normalizeNsu(value: string): string {
  const normalized = String(value ?? "").replace(/\D/g, "").slice(-15);
  return normalized.padStart(15, "0");
}

function decodeBase64(value: string): string {
  if (!value) throw new Error("Resposta vazia da SEFAZ.");
  return Buffer.from(value, "base64").toString("utf8");
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function nullableText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizeArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

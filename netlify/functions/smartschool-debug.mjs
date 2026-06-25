/**
 * DEBUG TEMPORAIRE — retourne les champs bruts d'un compte via getUserDetails
 * GET /.netlify/functions/smartschool-debug?internalNumber=4836
 */
export default async function handler(req) {
  const SS_URL  = process.env.SMARTSCHOOL_API_URL || 'https://espmaritime.smartschool.be/Webservices/V3'
  const SS_CODE = process.env.SMARTSCHOOL_ACCESS_CODE

  const url = new URL(req.url)
  const num = url.searchParams.get('internalNumber') || '4836'

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soa="http://www.smartschool.be/webservices">
  <soapenv:Body>
    <soa:getUserDetailsByNumber>
      <soa:accesscode>${SS_CODE}</soa:accesscode>
      <soa:number>${num}</soa:number>
    </soa:getUserDetailsByNumber>
  </soapenv:Body>
</soapenv:Envelope>`

  const res = await fetch(SS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"urn:getUserDetailsByNumber"' },
    body: envelope,
  })
  const xml = await res.text()

  // Extraire le JSON retourné
  const m = xml.match(/<[^:>]+:return[^>]*>([\s\S]*?)<\/[^:>]+:return>/i) || xml.match(/<return[^>]*>([\s\S]*?)<\/return>/i)
  let raw = m ? m[1].trim() : xml
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  if (cdata) raw = cdata[1].trim()

  let parsed
  try { parsed = JSON.parse(raw) } catch { parsed = raw }

  return new Response(JSON.stringify({ internalNumber: num, data: parsed }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}

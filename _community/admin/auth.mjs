import {createRemoteJWKSet, jwtVerify} from 'jose';

// This cache contains only public verification keys, never user sessions.
let issuer, keys;
export async function authenticate(request, env) {
  if (!env.ACCESS_ISSUER || !env.ACCESS_AUD || !env.ADMIN_EMAIL) throw Error('configuration');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) throw Error('authentication');
  if (issuer !== env.ACCESS_ISSUER) {
    if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER)) throw Error('configuration');
    issuer = env.ACCESS_ISSUER;
    keys = createRemoteJWKSet(new URL(issuer + '/cdn-cgi/access/certs'));
  }
  const {payload} = await jwtVerify(token, keys, {
    issuer, audience: env.ACCESS_AUD, algorithms:['RS256'], requiredClaims:['exp','iat','sub','email']
  });
  if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) throw Error('authentication');
  return payload;
}

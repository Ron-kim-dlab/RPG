function splitMongoUri(uri) {
  const schemeIndex = uri.indexOf("://");
  if (schemeIndex === -1) {
    throw new Error("Mongo URI must include a protocol such as mongodb:// or mongodb+srv://");
  }

  const protocol = uri.slice(0, schemeIndex + 3);
  const remainder = uri.slice(schemeIndex + 3);
  const slashIndex = remainder.indexOf("/");
  const authority = slashIndex === -1 ? remainder : remainder.slice(0, slashIndex);
  const hostPart = authority.includes("@") ? authority.slice(authority.lastIndexOf("@") + 1) : authority;
  const pathAndQuery = slashIndex === -1 ? "" : remainder.slice(slashIndex + 1);
  const queryIndex = pathAndQuery.indexOf("?");
  const queryString = queryIndex === -1 ? "" : pathAndQuery.slice(queryIndex + 1);

  return {
    protocol,
    hostPart,
    query: new URLSearchParams(queryString),
  };
}

export function buildMongoConnectionUri(baseUri, options) {
  const { username, password, database, authSource = database } = options;
  const { protocol, hostPart, query } = splitMongoUri(baseUri);

  query.set("authSource", authSource);

  const encodedUsername = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(password);
  const queryString = query.toString();

  return `${protocol}${encodedUsername}:${encodedPassword}@${hostPart}/${database}${queryString ? `?${queryString}` : ""}`;
}

export function redactMongoConnectionUri(uri) {
  const { protocol, hostPart, query } = splitMongoUri(uri);
  const queryString = query.toString();

  return `${protocol}***:***@${hostPart}${queryString ? `/?${queryString}` : ""}`;
}

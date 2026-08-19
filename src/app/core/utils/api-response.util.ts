export function extractApiList(response: any): any[] {
  if (!response) return [];

  const payload =
    response?.data ??
    response?.Data ??
    response?.result ??
    response?.Result ??
    response;

  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === 'object') {
    const nested =
      payload.sa_country_regions ??
      payload.Sa_country_regions ??
      payload.saCountryRegions ??
      payload.regions ??
      payload.Regions;

    if (Array.isArray(nested)) return nested;
    return [payload];
  }

  return [];
}

export function isApiSuccess(response: any): boolean {
  if (!response) return false;
  if (response.success === false || response.Success === false) return false;
  if (response.success === true || response.Success === true) return true;
  return extractApiList(response).length > 0;
}

export function extractApiData(response: any): any {
  if (!response) return null;
  return (
    response?.data ??
    response?.Data ??
    response?.result ??
    response?.Result ??
    null
  );
}

export function extractApiMessage(response: any): string {
  if (!response) return '';
  return (
    response?.message ??
    response?.Message ??
    response?.error ??
    response?.Error ??
    response?.title ??
    response?.Title ??
    ''
  );
}

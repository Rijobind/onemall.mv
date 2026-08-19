import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import { extractApiList } from '../../utils/api-response.util';

export interface MarketplaceRegion {
  country_region_id: string;
  region_name: string;
  status: string;
  sa_regions?: MarketplaceCity[];
}

export interface MarketplaceCity {
  region_id: string;
  country_region_id: string;
  region_name: string;
  city: string;
}

export interface RegionSelection {
  countryRegionId: string;
  regionName: string;
  city: string;
}

export interface MarketplaceProductParams {
  country_region_id?: string;
  region_name?: string;
  city?: string;
  /** Preferred display currency for backend conversion (e.g. MVR, USD). */
  currency_code?: string;
  /** Logged-in marketplace customer id. */
  user_id?: string;
  /** ISO country code hint (e.g. MV, US, IN). */
  country_code?: string;
}

function readString(raw: any, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw?.[key];
    if (value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeRegion(raw: any): MarketplaceRegion {
  const countryRegionId =
    readString(raw, 'country_region_id', 'CountryRegionId', 'countryRegionId') ||
    readString(raw, 'region_id', 'RegionId', 'regionId');

  return {
    country_region_id: countryRegionId,
    region_name: readString(raw, 'region_name', 'RegionName', 'regionName'),
    status: readString(raw, 'status', 'Status') || 'active',
    sa_regions: Array.isArray(raw?.sa_regions)
      ? raw.sa_regions.map(normalizeCity)
      : Array.isArray(raw?.Sa_regions)
        ? raw.Sa_regions.map(normalizeCity)
        : undefined,
  };
}

function normalizeCity(raw: any): MarketplaceCity {
  return {
    region_id: readString(raw, 'region_id', 'RegionId', 'regionId'),
    country_region_id:
      readString(raw, 'country_region_id', 'CountryRegionId', 'countryRegionId') ||
      readString(raw, 'region_id', 'RegionId', 'regionId'),
    region_name: readString(raw, 'region_name', 'RegionName', 'regionName'),
    city: readString(raw, 'city', 'City'),
  };
}

function isAtollRow(raw: any): boolean {
  const city = readString(raw, 'city', 'City');
  const regionName = readString(raw, 'region_name', 'RegionName', 'regionName');
  return !!regionName && !city;
}

function isCityRow(raw: any): boolean {
  return !!readString(raw, 'city', 'City');
}

@Injectable({
  providedIn: 'root',
})
export class RegionService {
  private readonly storageKey = 'marketplace_region_selection';
  private readonly defaultAtollName = 'Kaafu';
  private readonly defaultCity = 'Male';
  private readonly defaultAtollId = '7D304835-3893-4C05-9889-814A06D8C3B8';

  private readonly selectionSubject = new BehaviorSubject<RegionSelection>(
    this.loadFromStorage()
  );

  readonly selection$ = this.selectionSubject.asObservable();

  regions: MarketplaceRegion[] = [];
  cities: MarketplaceCity[] = [];
  private adminRegionRows: any[] = [];

  constructor(private api: BackendapiServices) {}

  get selection(): RegionSelection {
    return this.selectionSubject.getValue();
  }

  get hasSavedSelection(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(this.storageKey);
  }

  get displayLabel(): string {
    const { regionName, city } = this.getEffectiveSelection();
    const region = regionName || this.defaultAtollName;
    return city ? `${region} · ${city}` : region;
  }

  getEffectiveSelection(): RegionSelection {
    if (this.hasSavedSelection) {
      return this.selection;
    }
    return this.getDefaultEffectiveSelection();
  }

  getProductRequestParams(): MarketplaceProductParams {
    const { countryRegionId, regionName, city } = this.getEffectiveSelection();
    const params: MarketplaceProductParams = {};

    if (countryRegionId) {
      params.country_region_id = countryRegionId;
    }
    if (regionName) {
      params.region_name = regionName;
    }
    if (city) {
      params.city = city;
    }

    if (!this.hasSavedSelection) {
      if (!params.country_region_id) {
        params.country_region_id = this.defaultAtollId;
      }
      if (!params.region_name) {
        params.region_name = this.defaultAtollName;
      }
      if (!params.city) {
        params.city = this.defaultCity;
      }
    }

    return params;
  }

  /** Kaafu · Male — used to fill remaining home products. */
  getDefaultProductRequestParams(): MarketplaceProductParams {
    const kaafu = this.findRegionByName(this.defaultAtollName);
    return {
      country_region_id: kaafu?.country_region_id || this.defaultAtollId,
      region_name: kaafu?.region_name || this.defaultAtollName,
      city: this.defaultCity,
    };
  }

  isDefaultLocationSelected(): boolean {
    const current = this.getEffectiveSelection();
    const defaults = this.getDefaultProductRequestParams();
    const sameAtoll =
      String(current.countryRegionId || '').toLowerCase() ===
        String(defaults.country_region_id || '').toLowerCase() ||
      String(current.regionName || '').trim().toLowerCase() ===
        String(defaults.region_name || '').trim().toLowerCase();
    const sameCity =
      String(current.city || '').trim().toLowerCase() ===
      String(defaults.city || '').trim().toLowerCase();
    return sameAtoll && sameCity;
  }

  loadRegions(): Observable<any> {
    return this.api.getMarketplaceRegions().pipe(
      switchMap((res: any) => {
        const rows = extractApiList(res).map(normalizeRegion).filter((r) => r.region_name);
        if (rows.length) {
          this.regions = rows;
          this.syncSelectionWithRegions();
          return of(res);
        }
        return this.loadRegionsFromAdmin();
      }),
      catchError(() => this.loadRegionsFromAdmin())
    );
  }

  private loadRegionsFromAdmin(): Observable<any> {
    return this.api.getAdminRegionsList().pipe(
      tap((res: any) => {
        this.regions = this.parseAdminRegions(res);
        this.syncSelectionWithRegions();
      })
    );
  }

  private parseAdminRegions(response: any): MarketplaceRegion[] {
    const countries = extractApiList(response);
    const maldives =
      countries.find((c: any) =>
        readString(c, 'region_name', 'RegionName', 'regionName').toLowerCase().includes('maldives')
      ) ?? countries[0];

    const nestedRows = Array.isArray(maldives?.sa_regions)
      ? maldives.sa_regions
      : Array.isArray(maldives?.Sa_regions)
        ? maldives.Sa_regions
        : [];

    this.adminRegionRows = nestedRows;

    return nestedRows
      .filter(isAtollRow)
      .map((atoll: any) => {
        const atollId = readString(atoll, 'region_id', 'RegionId', 'regionId');
        const atollName = readString(atoll, 'region_name', 'RegionName', 'regionName');
        const nestedCities = nestedRows
          .filter(
            (row: any) =>
              isCityRow(row) &&
              readString(row, 'parent_id', 'ParentId', 'parentId') === atollId
          )
          .map((city: any) => ({
            ...normalizeCity(city),
            country_region_id: atollId,
            region_name: atollName,
          }));

        return {
          country_region_id: atollId,
          region_name: atollName,
          status: 'active',
          sa_regions: nestedCities,
        } as MarketplaceRegion;
      })
      .filter((region: MarketplaceRegion) => region.country_region_id && region.region_name)
      .sort((a: MarketplaceRegion, b: MarketplaceRegion) =>
        a.region_name.localeCompare(b.region_name));
  }

  loadCities(countryRegionId: string): Observable<any> {
    if (!countryRegionId) {
      this.cities = [];
      return of({ data: [] });
    }

    const selectedAtoll = this.regions.find((r) => r.country_region_id === countryRegionId);
    if (selectedAtoll?.sa_regions?.length) {
      this.cities = selectedAtoll.sa_regions;
      return of({ data: this.cities });
    }

    if (this.adminRegionRows.length) {
      const atollName = selectedAtoll?.region_name ?? '';
      this.cities = this.adminRegionRows
        .filter(
          (row: any) =>
            isCityRow(row) &&
            readString(row, 'parent_id', 'ParentId', 'parentId') === countryRegionId
        )
        .map((city: any) => ({
          ...normalizeCity(city),
          country_region_id: countryRegionId,
          region_name: atollName,
        }));
      return of({ data: this.cities });
    }

    return this.api.getMarketplaceCities(countryRegionId).pipe(
      tap((res: any) => {
        this.cities = extractApiList(res).map(normalizeCity);
      }),
      catchError(() => {
        this.cities = [];
        return of({ data: [] });
      })
    );
  }

  applySelection(selection: RegionSelection): void {
    const normalized: RegionSelection = {
      countryRegionId: String(selection.countryRegionId || '').trim(),
      regionName: String(selection.regionName || '').trim(),
      city: String(selection.city || '').trim(),
    };
    this.selectionSubject.next(normalized);
    this.saveToStorage(normalized);
    this.api.clearMarketplaceProductsCache();
    this.dispatchRegionUpdated();
  }

  private getDefaultEffectiveSelection(): RegionSelection {
    const kaafu = this.findRegionByName(this.defaultAtollName);
    return {
      countryRegionId: kaafu?.country_region_id || this.defaultAtollId,
      regionName: kaafu?.region_name || this.defaultAtollName,
      city: this.defaultCity,
    };
  }

  private findRegionByName(name: string): MarketplaceRegion | undefined {
    const normalized = name.trim().toLowerCase();
    return this.regions.find(
      (region) => region.region_name?.trim().toLowerCase() === normalized
    );
  }

  private syncSelectionWithRegions(): void {
    if (!this.regions.length) {
      return;
    }

    const current = this.selection;
    if (current.countryRegionId) {
      const match = this.regions.find(
        (region) => region.country_region_id === current.countryRegionId
      );
      if (match && !current.regionName) {
        this.selectionSubject.next({
          ...current,
          regionName: match.region_name,
        });
      }
      return;
    }

    if (current.regionName) {
      const match = this.findRegionByName(current.regionName);
      if (match) {
        this.selectionSubject.next({
          countryRegionId: match.country_region_id,
          regionName: match.region_name,
          city: current.city,
        });
      }
    }
  }

  private getDefaultSelection(): RegionSelection {
    return {
      countryRegionId: '',
      regionName: this.defaultAtollName,
      city: this.defaultCity,
    };
  }

  private loadFromStorage(): RegionSelection {
    if (typeof window === 'undefined') {
      return this.getDefaultSelection();
    }

    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return this.getDefaultSelection();
    }

    try {
      const parsed = JSON.parse(raw);
      return this.migrateLegacySelection({
        countryRegionId: String(parsed?.countryRegionId || '').trim(),
        regionName: String(parsed?.regionName || '').trim(),
        city: String(parsed?.city || '').trim(),
      });
    } catch {
      return this.getDefaultSelection();
    }
  }

  private migrateLegacySelection(selection: RegionSelection): RegionSelection {
    if (selection.regionName.trim().toLowerCase() === 'male' && !selection.city) {
      return this.getDefaultSelection();
    }
    return selection;
  }

  private saveToStorage(selection: RegionSelection): void {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(this.storageKey, JSON.stringify(selection));
  }

  private dispatchRegionUpdated(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent('region-updated'));
  }
}

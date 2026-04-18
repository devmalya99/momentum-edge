import { NseIndia } from 'stock-nse-india';

/** One client per server instance — reuses NSE session cookies inside the library. */
let nseIndia: NseIndia | null = null;

export function getNseIndiaClient(): NseIndia {
  if (!nseIndia) nseIndia = new NseIndia();
  return nseIndia;
}

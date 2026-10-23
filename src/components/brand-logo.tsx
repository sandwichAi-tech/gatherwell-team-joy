import plumLogo from '@/assets/logos/ZoheeWell_Logo_Adobe_Terracotta_3000px.png.asset.json';
import ivoryLogo from '@/assets/logos/ZoheeWell_Logo_Warm_Ivory.svg.asset.json';

/** Original supplied artwork; Terracotta on light backgrounds, Warm Ivory on dark. */
export function BrandLogo() {
  return <span className="brand-logo" aria-hidden="true">
    <img className="brand-logo-plum" src={plumLogo.url} alt="" width={522} height={105} />
    <img className="brand-logo-ivory" src={ivoryLogo.url} alt="" width={522} height={105} />
  </span>;
}

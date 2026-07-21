// Flag SVG asset URLs for the shareable-card canvas renderer. Vite bundles each
// as a same-origin hashed asset, so drawing them onto a canvas never taints it
// (toBlob works). Only the codes the app can use — extend when real teams are
// seeded, alongside src/styles/flags.css.

import f_al from 'flag-icons/flags/4x3/al.svg'
import f_at from 'flag-icons/flags/4x3/at.svg'
import f_be from 'flag-icons/flags/4x3/be.svg'
import f_ch from 'flag-icons/flags/4x3/ch.svg'
import f_cz from 'flag-icons/flags/4x3/cz.svg'
import f_de from 'flag-icons/flags/4x3/de.svg'
import f_dk from 'flag-icons/flags/4x3/dk.svg'
import f_es from 'flag-icons/flags/4x3/es.svg'
import f_fr from 'flag-icons/flags/4x3/fr.svg'
import f_gb_eng from 'flag-icons/flags/4x3/gb-eng.svg'
import f_gb_nir from 'flag-icons/flags/4x3/gb-nir.svg'
import f_gb_sct from 'flag-icons/flags/4x3/gb-sct.svg'
import f_gb_wls from 'flag-icons/flags/4x3/gb-wls.svg'
import f_hr from 'flag-icons/flags/4x3/hr.svg'
import f_hu from 'flag-icons/flags/4x3/hu.svg'
import f_ie from 'flag-icons/flags/4x3/ie.svg'
import f_it from 'flag-icons/flags/4x3/it.svg'
import f_nl from 'flag-icons/flags/4x3/nl.svg'
import f_pl from 'flag-icons/flags/4x3/pl.svg'
import f_pt from 'flag-icons/flags/4x3/pt.svg'
import f_ro from 'flag-icons/flags/4x3/ro.svg'
import f_rs from 'flag-icons/flags/4x3/rs.svg'
import f_se from 'flag-icons/flags/4x3/se.svg'
import f_sk from 'flag-icons/flags/4x3/sk.svg'
import f_tr from 'flag-icons/flags/4x3/tr.svg'
import f_ua from 'flag-icons/flags/4x3/ua.svg'

const FLAG_URL: Record<string, string> = {
  'al': f_al,
  'at': f_at,
  'be': f_be,
  'ch': f_ch,
  'cz': f_cz,
  'de': f_de,
  'dk': f_dk,
  'es': f_es,
  'fr': f_fr,
  'gb-eng': f_gb_eng,
  'gb-nir': f_gb_nir,
  'gb-sct': f_gb_sct,
  'gb-wls': f_gb_wls,
  'hr': f_hr,
  'hu': f_hu,
  'ie': f_ie,
  'it': f_it,
  'nl': f_nl,
  'pl': f_pl,
  'pt': f_pt,
  'ro': f_ro,
  'rs': f_rs,
  'se': f_se,
  'sk': f_sk,
  'tr': f_tr,
  'ua': f_ua,
}

/** The bundled SVG URL for a country code, or null when we don't ship that flag. */
export function flagUrl(countryCode: string): string | null {
  return FLAG_URL[countryCode.toLowerCase()] ?? null
}

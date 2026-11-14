/** Stand-in for `next/link` in the single-file preview build: a plain anchor that points into the hash. */
import type { AnchorHTMLAttributes, Ref } from "react"

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string
  ref?: Ref<HTMLAnchorElement>
  prefetch?: boolean
  scroll?: boolean
  replace?: boolean
}

export default function Link({ href, prefetch: _p, scroll: _s, replace: _r, ...rest }: Props) {
  const external = /^[a-z][a-z0-9+.-]*:/i.test(href)
  return <a href={external ? href : `#${href}`} {...rest} />
}

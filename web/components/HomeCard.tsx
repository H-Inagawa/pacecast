import Link from "next/link";
import type { ReactNode } from "react";

type Size = "lg" | "md" | "sm";

type SharedProps = {
  size: Size;
  imageSrc: string;
  label: string;
  lede?: string;
  className?: string;
};

type LinkCardProps = SharedProps & {
  href: string;
  onClick?: never;
};

type ButtonCardProps = SharedProps & {
  href?: never;
  onClick: () => void;
};

type Props = LinkCardProps | ButtonCardProps;

function cardClassName(size: Size, className?: string): string {
  return ["home-card", `home-card--${size}`, className].filter(Boolean).join(" ");
}

function CardInner({
  imageSrc,
  label,
  lede,
}: {
  imageSrc: string;
  label: string;
  lede?: string;
}): ReactNode {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative card watermark */}
      <img className="home-card__bg" src={imageSrc} alt="" aria-hidden="true" />
      <span className="home-card__overlay" aria-hidden="true" />
      <span className="home-card__content">
        <span className="home-card__label">{label}</span>
        {lede ? <span className="home-card__lede">{lede}</span> : null}
      </span>
    </>
  );
}

export function HomeCard(props: Props) {
  const { size, imageSrc, label, lede, className } = props;
  const classes = cardClassName(size, className);

  if ("href" in props && props.href) {
    return (
      <Link className={classes} href={props.href}>
        <CardInner imageSrc={imageSrc} label={label} lede={lede} />
      </Link>
    );
  }

  return (
    <button type="button" className={classes} onClick={props.onClick}>
      <CardInner imageSrc={imageSrc} label={label} lede={lede} />
    </button>
  );
}

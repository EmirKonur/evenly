import { formatMoney, type Cents, type CurrencyCode } from '@/money';

import { Text, type AppTextProps } from './Text';

export interface MoneyProps extends Omit<AppTextProps, 'children' | 'tone'> {
  amount: Cents;
  currency: CurrencyCode;
  /** `balance` colors by sign: mint when positive (owed to you), berry when negative. */
  tone?: AppTextProps['tone'] | 'balance';
  /** `always` prints "+€4.00"; `never` drops the sign when the words already say it. */
  sign?: 'auto' | 'always' | 'never';
}

export function Money({
  amount,
  currency,
  tone = 'ink',
  sign = 'auto',
  variant = 'amount',
  style,
  ...props
}: MoneyProps) {
  const resolvedTone =
    tone === 'balance' ? (amount > 0 ? 'owed' : amount < 0 ? 'owe' : 'soft') : tone;
  const signDisplay = sign === 'always' ? 'exceptZero' : sign;
  return (
    <Text
      variant={variant}
      tone={resolvedTone}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      {...props}
    >
      {formatMoney(amount, currency, { signDisplay })}
    </Text>
  );
}

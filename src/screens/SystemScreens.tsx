import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { LogoMark } from '../components/ui/brand';
import { Card } from '../components/ui/controls';

export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, duration: 0.4 }}>
        <LogoMark size={56} animate={false} />
      </motion.div>
    </div>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <Card className="w-full max-w-[460px] p-7">
        <LogoMark size={40} animate={false} />
        <h1 className="mt-5 text-[24px] font-bold tracking-[-0.02em]">{title}</h1>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
      </Card>
    </div>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded-md bg-fill-2 px-1.5 py-0.5 font-mono text-[13px] text-ink">{children}</code>
);

export function SetupNeeded() {
  return (
    <Message title="Connect Firebase">
      <p>
        Plate needs a Firebase project. Copy <Code>.env.example</Code> to <Code>.env.local</Code> and fill in your web
        app config, then restart the dev server.
      </p>
      <p>
        To look around without Firebase, run <Code>npm run demo</Code>.
      </p>
    </Message>
  );
}

export function BootError({ message }: { message: string }) {
  return (
    <Message title="Plate couldn't start">
      <p>{message}</p>
      <p>Check your connection and reload the page.</p>
    </Message>
  );
}

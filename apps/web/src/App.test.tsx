import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppShell, HomePage } from './App.js';
import { LocaleProvider } from './lib/i18n/index.js';

describe('App localization shell', () => {
  it('renders the redesigned home room-entry surface with both actions disabled by default', () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider initialLocale="en">
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(markup).toContain('Run the table.');
    expect(markup).toContain('Create room');
    expect(markup).toContain('Join room');
    expect(markup).toContain('Display name');
    expect(markup).toContain('Room code');
    expect(markup.match(/disabled=""/g)?.length ?? 0).toBe(2);
  });

  it('renders the language selector in the shared header on both home and room routes', () => {
    const homeMarkup = renderToStaticMarkup(
      <LocaleProvider initialLocale="en">
        <MemoryRouter initialEntries={['/']}>
          <AppShell />
        </MemoryRouter>
      </LocaleProvider>,
    );
    const roomMarkup = renderToStaticMarkup(
      <LocaleProvider initialLocale="en">
        <MemoryRouter initialEntries={['/rooms/ABCD']}>
          <AppShell />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(homeMarkup).toContain('aria-label="Language"');
    expect(homeMarkup).toContain('<option value="en"');
    expect(homeMarkup).toContain('<option value="ru"');
    expect(homeMarkup).toContain('<option value="ru-x-fenya"');
    expect(roomMarkup).toContain('Snapshot room sync');
    expect(roomMarkup).toContain('aria-label="Language"');
  });

  it('renders Russian UI copy in the shared shell and room fallback route', () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider initialLocale="ru">
        <MemoryRouter initialEntries={['/rooms/ABCD']}>
          <AppShell />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(markup).toContain('Язык');
    expect(markup).toContain('Приватные комнаты');
    expect(markup).toContain('Синхронизация снимков комнаты');
    expect(markup).toContain('Сессия комнаты не найдена');
    expect(markup).toContain('Имя игрока');
    expect(markup).toContain('Войти в комнату');
  });
});

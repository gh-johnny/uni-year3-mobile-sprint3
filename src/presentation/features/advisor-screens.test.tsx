import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { Leads } from '@/domain/retention/leads';
import { Result } from '@/domain/shared/result';
import { createTestServices, renderWithServices, signInAs, TestServices } from '@/test-utils/render';
import { resetRouter, routerSpy, setRouteParams } from '@/test-utils/router-mock';

import { useSession } from '../state/session-store';
import { useToasts } from '../state/toast-store';
import { LeadScreen } from './lead/lead-screen';
import { PulseScreen } from './pulse/pulse-screen';
import { blipPosition, hashUnit } from './radar/radar-sweep';
import { RadarScreen } from './radar/radar-screen';

jest.mock('expo-router', () => require('@/test-utils/router-mock').expoRouterMock);

jest.setTimeout(30000);

const toasts = () => useToasts.getState().toasts.map((toast) => toast.title);

let services: TestServices;

beforeEach(async () => {
  resetRouter();
  services = await createTestServices();
  await signInAs(services, 'advisor');
});

const cases = () => services.container.useCases;
const advisor = async () => useSession.getState().user!;

describe('PulseScreen', () => {
  it('shows Service Share for the dealer against the network, with trend and breakdown', async () => {
    await renderWithServices(<PulseScreen />, services);

    expect(await screen.findByTestId('pulse-hero')).toBeOnTheScreen();
    expect(screen.getByTestId('share-value')).toHaveTextContent(/\d+(\.\d+)?%/);
    expect(screen.getByTestId('share-delta')).toHaveTextContent(/pts vs network/);
    expect(screen.getByTestId('trend-chart')).toBeOnTheScreen();
    expect(screen.getByTestId('breakdown-bars')).toBeOnTheScreen();
    expect(screen.getByText(/Network average:/)).toBeOnTheScreen();
    expect(screen.getByTestId('sync-pill')).toBeOnTheScreen();
  });

  it('slices the share by dealer, model, age and service', async () => {
    await renderWithServices(<PulseScreen />, services);
    await screen.findByTestId('pulse-hero');

    await userEvent.press(screen.getByText('Model'));
    expect(await screen.findByText(/Network average:/)).toBeOnTheScreen();
    await userEvent.press(screen.getByText('Age'));
    expect((await screen.findAllByText(/yrs$/)).length).toBeGreaterThan(0);
    await userEvent.press(screen.getByText('Service'));
    expect(await screen.findByText('Share of each job done inside the network')).toBeOnTheScreen();
    await userEvent.press(screen.getByText('Dealer'));
    expect(screen.getByText(/Network average:/)).toBeOnTheScreen();
  });

  it('reports anomalies, or says nothing is out of line', async () => {
    const report = (await cases().getPulse.execute(await advisor())).value;
    const spy = jest.spyOn(cases().getPulse, 'execute').mockResolvedValue(
      Result.ok({ ...report, anomalies: [{ key: report.breakdowns.dealer[0]!.key, zScore: -2.4, direction: 'below', deltaPoints: -18 }], trendBreak: { month: new Date(), zScore: 2, deltaPoints: 6 } }),
    );
    const view = await renderWithServices(<PulseScreen />, services);
    expect(await screen.findByTestId(`anomaly-${report.breakdowns.dealer[0]!.key}`)).toBeOnTheScreen();
    expect(screen.getByTestId('trend-break')).toBeOnTheScreen();
    await view.unmount();

    spy.mockResolvedValue(Result.ok({ ...report, anomalies: [], trendBreak: null }));
    await renderWithServices(<PulseScreen />, services);
    expect(await screen.findByText('No dealer is statistically out of line.')).toBeOnTheScreen();
  });

  it('is off limits to owners', async () => {
    await signInAs(services, 'owner');
    await renderWithServices(<PulseScreen />, services);
    expect(await screen.findByText('You do not have access to this.')).toBeOnTheScreen();
  });
});

describe('RadarScreen', () => {
  it('draws the radar and lists leads, most at risk first, opening the lead sheet on tap', async () => {
    await renderWithServices(<RadarScreen />, services);
    expect(await screen.findByTestId('radar-sweep')).toBeOnTheScreen();

    const rows = screen.getAllByTestId(/^lead-/);
    expect(rows.length).toBeGreaterThan(0);
    await userEvent.press(rows[0]!);
    expect(routerSpy.push).toHaveBeenCalledWith(expect.stringMatching(/^\/lead\//));
  });

  it('filters with specifications and counts each filter', async () => {
    await renderWithServices(<RadarScreen />, services);
    await screen.findByTestId('radar-sweep');
    const all = screen.getAllByTestId(/^lead-/).length;

    await userEvent.press(screen.getByTestId('filter-critical'));
    const critical = screen.queryAllByTestId(/^lead-/).length;
    expect(critical).toBeLessThanOrEqual(all);
    await userEvent.press(screen.getByTestId('filter-open'));
    await userEvent.press(screen.getByTestId('filter-warranty'));
    await userEvent.press(screen.getByTestId('filter-contactable'));
    await userEvent.press(screen.getByTestId('filter-all'));
    expect(screen.getAllByTestId(/^lead-/)).toHaveLength(all);
  });

  it('says so when no lead matches', async () => {
    const radar = (await cases().getRadar.execute(await advisor())).value;
    jest.spyOn(cases().getRadar, 'execute').mockResolvedValue(Result.ok({ ...radar, leads: Leads.of([]) }));
    await renderWithServices(<RadarScreen />, services);
    expect(await screen.findByText('No leads match this filter')).toBeOnTheScreen();
  });

  it('refreshes itself when a lead moves in the pipeline', async () => {
    await renderWithServices(<RadarScreen />, services);
    await screen.findByTestId('radar-sweep');
    const radar = (await cases().getRadar.execute(await advisor())).value;
    const target = radar.leads.first()!;
    await cases().updateLeadStatus.execute(await advisor(), target.vehicleId, 'scheduled');
    await waitFor(() => expect(screen.getByTestId(`lead-${target.vehicleId}`)).toHaveTextContent(/Scheduled/));
  });

  it('places riskier leads nearer the centre, deterministically', () => {
    expect(hashUnit('lead-1')).toBe(hashUnit('lead-1'));
    expect(hashUnit('lead-1')).not.toBe(hashUnit('lead-2'));
    expect(hashUnit('x')).toBeGreaterThanOrEqual(0);
    expect(hashUnit('x')).toBeLessThan(1);
    const distance = (probability: number) => {
      const { x, y } = blipPosition({ id: 'same', tier: 'high', probability }, 100);
      return Math.hypot(x - 100, y - 100);
    };
    expect(distance(0.95)).toBeLessThan(distance(0.5));
    expect(distance(0.3)).toBeLessThanOrEqual(92 + 0.001);
    expect(distance(1)).toBeGreaterThanOrEqual(30 - 0.001);
  });
});

describe('LeadScreen', () => {
  const pick = async (predicate: (lead: Awaited<ReturnType<typeof firstLeads>>[number]) => boolean) => (await firstLeads()).find(predicate);
  const firstLeads = async () => (await cases().getRadar.execute(await advisor())).value.leads.mostAtRisk().toArray();

  it('explains the risk, then logs the outreach and shows it in the log', async () => {
    const lead = (await pick((candidate) => candidate.consent && candidate.status === 'new'))!;
    setRouteParams({ vehicleId: lead.vehicleId });
    await renderWithServices(<LeadScreen />, services);

    expect(await screen.findByTestId('risk-gauge')).toBeOnTheScreen();
    expect(screen.getByTestId('lead-tier')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^feature-/).length).toBeGreaterThan(0);
    expect(screen.getByText('No contact yet')).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('contact-lead'));
    await waitFor(() => expect(toasts()).toContain('Outreach logged and queued for sync'));
    expect(await screen.findByText(/Contacted/)).toBeOnTheScreen();
    expect(screen.queryByText('No contact yet')).not.toBeOnTheScreen();
    expect(await cases().repositories.outbox.pendingCount()).toBeGreaterThan(0);
  });

  it('walks the pipeline: scheduled → won, offering only valid moves', async () => {
    const lead = (await pick((candidate) => candidate.status === 'new'))!;
    setRouteParams({ vehicleId: lead.vehicleId });
    await renderWithServices(<LeadScreen />, services);
    await screen.findByTestId('risk-gauge');
    expect(screen.queryByTestId('move-won')).not.toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('move-scheduled'));
    await waitFor(() => expect(toasts()).toContain('Lead moved to Scheduled'));
    await userEvent.press(await screen.findByTestId('move-won'));
    await waitFor(() => expect(toasts()).toContain('Lead moved to Won'));
    await waitFor(() => expect(screen.queryByTestId('move-scheduled')).not.toBeOnTheScreen());
    expect(screen.getByTestId('lead-status')).toHaveTextContent('Won');
  });

  it('disables outreach without LGPD consent', async () => {
    const lead = await pick((candidate) => !candidate.consent);
    if (!lead) return;
    setRouteParams({ vehicleId: lead.vehicleId });
    await renderWithServices(<LeadScreen />, services);
    expect(await screen.findByTestId('no-consent')).toBeOnTheScreen();
    expect(screen.getByTestId('contact-lead')).toBeDisabled();
  });

  it('surfaces a rejected move and a missing lead', async () => {
    const lead = (await firstLeads())[0]!;
    setRouteParams({ vehicleId: lead.vehicleId });
    jest.spyOn(cases().updateLeadStatus, 'execute').mockResolvedValue(Result.fail('lead.invalidTransition'));
    await renderWithServices(<LeadScreen />, services);
    await userEvent.press(await screen.findByTestId('move-lost'));
    await waitFor(() => expect(toasts()).toContain('That move is not allowed for this lead.'));

    setRouteParams({ vehicleId: 'ghost' });
    await renderWithServices(<LeadScreen />, services);
    expect((await screen.findAllByText('Lead not found.')).length).toBeGreaterThan(0);
  });
});

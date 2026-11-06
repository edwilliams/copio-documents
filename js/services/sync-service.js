import { notify } from './notify.js';
import { getIceServers } from './ice-servers.js';
import { loadPeerJs, loadQrCode } from '../utils/module-loader.js';
import { createMergeableStore } from '../lib/tinybase.6.5.2.js';

const CONNECT_TIMEOUT_MS = 30000;

/**
 * Handles PeerJS peer-to-peer sync between host and joiner devices for TinyBase store.
 */
export class SyncManager {
  #peer = null;
  #target = null;
  #onStateChange = null;
  #syncState = null;
  #session = 0;
  #connectTimer = null;

  constructor(storeOrRepo, onStateChange) {
    this.#target = storeOrRepo;
    this.#onStateChange = onStateChange;
  }

  get state() {
    return this.#syncState;
  }

  #setState(newState) {
    this.#syncState = newState;
    if (this.#onStateChange) {
      this.#onStateChange(this.#syncState);
    }
  }

  #fail(message) {
    clearTimeout(this.#connectTimer);
    if (!this.#syncState) return;
    this.#setState({ ...this.#syncState, step: 'error', message });
  }

  /**
   * Creates a Peer configured with working STUN/TURN servers.
   * PeerJS's built-in TURN servers no longer exist, so cross-device links fail without this.
   * Returns null if the session was closed while fetching credentials.
   */
  async #createPeer() {
    const session = ++this.#session;
    const [iceServers, Peer] = await Promise.all([
      getIceServers(),
      loadPeerJs(),
    ]);
    if (session !== this.#session) return null;
    return new Peer({ config: { iceServers } });
  }

  /** Logs ICE progress and surfaces ICE failure (otherwise the dialog hangs silently). */
  #watchConnection(conn) {
    conn.on('error', (err) => this.#fail(err.message));
    const pc = conn.peerConnection;
    if (!pc) return;
    pc.addEventListener('iceconnectionstatechange', () => {
      console.log('[Sync] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        this.#fail('Could not connect to the other device. Check both are online and try again.');
      }
    });
  }

  #startConnectTimer() {
    clearTimeout(this.#connectTimer);
    this.#connectTimer = setTimeout(() => {
      const step = this.#syncState?.step;
      if (step && step !== 'done' && step !== 'error') {
        this.#fail('Connection timed out. Try again.');
      }
    }, CONNECT_TIMEOUT_MS);
  }

  #onConnOpen(conn) {
    const setupConn = () => {
      clearTimeout(this.#connectTimer);
      this.#setState({ ...this.#syncState, step: 'syncing' });
      this.#doSync(conn);
    };
    if (conn.open) {
      setupConn();
    } else {
      conn.on('open', setupConn);
    }
  }

  startHost() {
    if (this.#syncState?.mode === 'host') return;

    if (!navigator.onLine) {
      notify.warning('An internet connection is needed to link devices.', {
        icon: 'wifi-off',
        duration: 4000,
      });
      return;
    }

    this.#setState({ mode: 'host', step: 'init' });
    this.#startHostAsync().catch((err) => {
      this.#setState({ mode: 'host', step: 'error', message: err.message });
    });
  }

  async #startHostAsync() {
    const peer = await this.#createPeer();
    if (!peer) return;
    this.#peer = peer;

    peer.on('error', (err) => this.#fail(err.message));
    peer.on('open', async (id) => {
      const url = `${location.origin}${location.pathname}?peer=${id}`;
      const qrcode = await loadQrCode();
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      this.#setState({
        mode: 'host',
        step: 'waiting',
        qrSvg: qr.createSvgTag(4, 8),
        url,
        peerId: id,
      });
    });
    peer.on('connection', (conn) => {
      this.#startConnectTimer();
      this.#watchConnection(conn);
      this.#onConnOpen(conn);
    });
  }

  startJoiner(remotePeerId) {
    if (this.#syncState?.mode === 'joiner') return;

    this.#setState({ mode: 'joiner', step: 'connecting' });
    this.#startConnectTimer();
    this.#startJoinerAsync(remotePeerId).catch((err) => {
      this.#setState({ mode: 'joiner', step: 'error', message: err.message });
    });
  }

  async #startJoinerAsync(remotePeerId) {
    const peer = await this.#createPeer();
    if (!peer) return;
    this.#peer = peer;

    peer.on('error', (err) => this.#fail(err.message));
    peer.on('open', () => {
      const conn = peer.connect(remotePeerId);
      this.#watchConnection(conn);
      this.#onConnOpen(conn);
    });
  }

  #doSync(conn) {
    conn.on('data', async (raw) => {
      let data;
      try {
        data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (err) {
        console.error('Failed to parse sync data:', err);
        return;
      }
      let added = 0;
      if (typeof this.#target?.importSyncPayload === 'function') {
        added = await this.#target.importSyncPayload(data);
      } else if (
        typeof this.#target?.isMergeable === 'function' &&
        this.#target.isMergeable() &&
        data?.type === 'mergeable' &&
        data?.content
      ) {
        const prevDocIds = new Set(this.#target.hasTable('docs') ? this.#target.getRowIds('docs') : []);
        const incoming = createMergeableStore().setMergeableContent(data.content);
        this.#target.merge(incoming);
        const afterDocIds = this.#target.hasTable('docs') ? this.#target.getRowIds('docs') : [];
        added = afterDocIds.filter((id) => !prevDocIds.has(id)).length;
      } else if (typeof this.#target?.importDocs === 'function') {
        const rows = data?.type === 'legacy' ? data.docs : data;
        added = await this.#target.importDocs(rows);
      } else if (typeof this.#target?.transaction === 'function') {
        const rows = data?.type === 'legacy' ? data.docs : data;
        this.#target.transaction(() => {
          for (const [id, row] of Object.entries(rows || {})) {
            if (!this.#target.hasRow('docs', id)) added++;
            this.#target.setRow('docs', id, row);
          }
        });
      }
      this.#setState({ ...this.#syncState, step: 'done', added });
      notify.success(`Sync complete — ${added} doc${added !== 1 ? 's' : ''} added`);
    });

    (async () => {
      try {
        let payload;
        if (typeof this.#target?.getSyncPayload === 'function') {
          payload = await this.#target.getSyncPayload();
        } else if (typeof this.#target?.isMergeable === 'function' && this.#target.isMergeable()) {
          payload = {
            type: 'mergeable',
            content: this.#target.getMergeableContent(),
          };
        } else if (typeof this.#target?.exportAll === 'function') {
          payload = {
            type: 'legacy',
            docs: await this.#target.exportAll(),
          };
        } else if (typeof this.#target?.getTable === 'function') {
          payload = {
            type: 'legacy',
            docs: this.#target.getTable('docs'),
          };
        } else {
          payload = {};
        }
        conn.send(JSON.stringify(payload));
      } catch (err) {
        console.error('Failed to send sync data:', err);
        this.#fail(err.message);
      }
    })();
  }

  close() {
    this.#session++; // invalidate any in-flight peer creation
    clearTimeout(this.#connectTimer);
    this.#peer?.destroy();
    this.#peer = null;
    this.#setState(null);
  }
}

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKvStore } from '../kv/memory-kv.store';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  let kv: MemoryKvStore;
  let sms: SmsService;

  beforeEach(() => {
    kv = new MemoryKvStore();
    sms = new SmsService(kv);
    process.env.SMS_PROVIDER = 'mock';
    process.env.SMS_MOCK_CODE = '123456';
  });

  it('rejects invalid mobile', async () => {
    const r = await sms.sendCode('13800138000');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'VALIDATION_ERROR');
  });

  it('sends and verifies mock code', async () => {
    const send = await sms.sendCode('+8613800138000');
    assert.equal(send.ok, true);
    const bad = await sms.verifyAndConsume('+8613800138000', '000000');
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.code, 'SMS_CODE_INVALID');
    const ok = await sms.verifyAndConsume('+8613800138000', '123456');
    assert.equal(ok.ok, true);
    // consumed
    const again = await sms.verifyAndConsume('+8613800138000', '123456');
    assert.equal(again.ok, false);
  });

  it('rate limits gap sends', async () => {
    assert.equal((await sms.sendCode('+8613800138001')).ok, true);
    const second = await sms.sendCode('+8613800138001');
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.code, 'SMS_RATE_LIMITED');
  });

  it('locks after 5 failed verifies', async () => {
    await sms.sendCode('+8613800138002');
    for (let i = 0; i < 4; i++) {
      const r = await sms.verifyAndConsume('+8613800138002', '000000');
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, 'SMS_CODE_INVALID');
    }
    const locked = await sms.verifyAndConsume('+8613800138002', '000000');
    assert.equal(locked.ok, false);
    if (!locked.ok) assert.equal(locked.code, 'AUTH_LOCKED');
  });
});

from __future__ import annotations

import base64
import os
from typing import Dict

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

ALGO = algorithms.AES
TAG_LENGTH = 16
IV_LENGTH = 12

_key_store: Dict[str, bytes] = {}


def create_card_key(key_id: str) -> bytes:
  key = os.urandom(32)
  _key_store[key_id] = key
  return key


def encrypt_card(card_id: str, key_id: str):
  key = _key_store.get(key_id)
  if key is None:
    raise KeyError(f"Missing key {key_id}")
  iv = os.urandom(IV_LENGTH)
  cipher = Cipher(ALGO(key), modes.GCM(iv), backend=default_backend())
  encryptor = cipher.encryptor()
  ciphertext = encryptor.update(card_id.encode("utf8")) + encryptor.finalize()
  tag = encryptor.tag
  return {
    "keyId": key_id,
    "iv": base64.b64encode(iv).decode("utf8"),
    "tag": base64.b64encode(tag).decode("utf8"),
    "ciphertext": base64.b64encode(ciphertext).decode("utf8"),
  }


def decrypt_card(token: dict):
  key = _key_store.get(token["keyId"])
  if key is None:
    raise KeyError(f"Missing key {token['keyId']}")
  iv = base64.b64decode(token["iv"])
  tag = base64.b64decode(token["tag"])
  ciphertext = base64.b64decode(token["ciphertext"])
  cipher = Cipher(ALGO(key), modes.GCM(iv, tag), backend=default_backend())
  decryptor = cipher.decryptor()
  return decryptor.update(ciphertext) + decryptor.finalize()


def list_keys():
  return list(_key_store.keys())

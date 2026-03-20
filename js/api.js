/* ========================================
   CyVIP Dashboard - API Client
   ======================================== */

var CyvipAPI = (function () {
  // Base URL — update when deployed
  var BASE = 'https://s82.app/cyvip/api';
  var _key = '';

  function setKey(k) { _key = k; }
  function getKey() { return _key; }

  function headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': _key
    };
  }

  function handleRes(res) {
    if (!res.ok) {
      return res.json().then(function (b) {
        throw new Error(b.detail || b.message || 'Request failed');
      }).catch(function (e) {
        if (e.message) throw e;
        throw new Error('HTTP ' + res.status);
      });
    }
    return res.json();
  }

  return {
    setKey: setKey,
    getKey: getKey,

    // Validate key by attempting a protected call
    validateKey: function () {
      return fetch(BASE + '/submissions', { headers: headers() })
        .then(handleRes);
    },

    fetchSubmissions: function () {
      return fetch(BASE + '/submissions', { headers: headers() })
        .then(handleRes);
    },

    fetchSubmission: function (id) {
      return fetch(BASE + '/submissions/' + id, { headers: headers() })
        .then(handleRes);
    },

    updateStatus: function (id, status) {
      return fetch(BASE + '/submissions/' + id, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: status })
      }).then(handleRes);
    },

    deleteSubmission: function (id) {
      return fetch(BASE + '/submissions/' + id, {
        method: 'DELETE',
        headers: headers()
      }).then(handleRes);
    }
  };
})();

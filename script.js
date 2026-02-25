/* ── STATE ── */
var STORAGE_KEY = 'bball_scorer_v1';
var TUTORIAL_KEY = 'bball_tutorial_seen';
var PERIODS = ['Q1','Q2','Q3','Q4'];

var state = {
  homeName: 'HOME',
  awayName: 'AWAY',
  periodIndex: 0,
  overtimeCount: 0,
  home: { players: [], score: 0, timeouts: [false,false,false,false,false], teamFouls: 0 },
  away: { players: [], score: 0, timeouts: [false,false,false,false,false], teamFouls: 0 },
  history: [],
  activePlayer: null,
  statsView: 'home'
};

function makePlayer(name, number) {
  return {
    name: name, number: number,
    pts: 0, pts2: 0, pts3: 0, ft: 0,
    miss2: 0, miss3: 0, missft: 0,
    ast: 0, oreb: 0, dreb: 0,
    stl: 0, blk: 0, to: 0, fls: 0
  };
}

/* ── PERSISTENCE ── */
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
}

function loadState() {
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      for (var k in parsed) { if (parsed.hasOwnProperty(k)) state[k] = parsed[k]; }
      // Initialize timeouts if missing (backward compatibility)
      if (!state.home.timeouts) state.home.timeouts = [false,false,false,false,false];
      if (!state.away.timeouts) state.away.timeouts = [false,false,false,false,false];
      // Initialize team fouls if missing (backward compatibility)
      if (state.home.teamFouls === undefined) state.home.teamFouls = 0;
      if (state.away.teamFouls === undefined) state.away.teamFouls = 0;
      // Cap team fouls at 5
      if (state.home.teamFouls > 5) state.home.teamFouls = 5;
      if (state.away.teamFouls > 5) state.away.teamFouls = 5;
      // Initialize new stat fields for existing players (backward compatibility)
      ['home', 'away'].forEach(function(team) {
        if (state[team].players) {
          state[team].players.forEach(function(p) {
            if (p.missft === undefined) p.missft = 0;
            if (p.miss2 === undefined) p.miss2 = 0;
            if (p.miss3 === undefined) p.miss3 = 0;
            if (p.oreb === undefined) p.oreb = 0;
            if (p.dreb === undefined) p.dreb = 0;
            if (p.to === undefined) p.to = 0;
          });
        }
      });
    }
  } catch(e) {}
}

/* ── PERIOD ── */
function getPeriodLabel() {
  if (state.periodIndex < 4) return PERIODS[state.periodIndex];
  return 'OT' + (state.periodIndex - 3);
}

function nextPeriod() {
  state.periodIndex++;
  // Reset team fouls on new quarter
  state.home.teamFouls = 0;
  state.away.teamFouls = 0;
  updatePeriod();
  updateTeamFouls();
  saveState();
  showPeriodChangeModal();
}

function prevPeriod() {
  if (state.periodIndex > 0) {
    state.periodIndex--;
    // Reset team fouls on quarter change
    state.home.teamFouls = 0;
    state.away.teamFouls = 0;
    updatePeriod();
    updateTeamFouls();
    saveState();
    showPeriodChangeModal();
  }
}

function updatePeriod() {
  document.getElementById('periodLabel').textContent = getPeriodLabel();
}

function showPeriodChangeModal() {
  var periodLabel = getPeriodLabel();
  var periodName = periodLabel;
  if (periodLabel === 'Q1') periodName = 'Quarter 1';
  else if (periodLabel === 'Q2') periodName = 'Quarter 2';
  else if (periodLabel === 'Q3') periodName = 'Quarter 3';
  else if (periodLabel === 'Q4') periodName = 'Quarter 4';
  else periodName = 'Overtime ' + (state.periodIndex - 3);

  document.getElementById('periodChangeTitle').textContent = periodName;
  document.getElementById('periodChangeMessage').textContent = 'Team fouls reset. Ready to continue?';
  document.getElementById('periodHomeTeam').textContent = state.homeName;
  document.getElementById('periodAwayTeam').textContent = state.awayName;
  document.getElementById('periodHomeScore').textContent = state.home.score;
  document.getElementById('periodAwayScore').textContent = state.away.score;
  document.getElementById('periodModal').classList.add('show');
}

function closePeriodModal() {
  document.getElementById('periodModal').classList.remove('show');
}

function updateTeamFouls() {
  var homeCount = document.getElementById('homeFoulCount');
  var awayCount = document.getElementById('awayFoulCount');
  var homeStatus = document.getElementById('homeFoulStatus');
  var awayStatus = document.getElementById('awayFoulStatus');

  homeCount.textContent = state.home.teamFouls;
  awayCount.textContent = state.away.teamFouls;

  // Add visual indicator for bonus/penalty
  homeCount.className = 'foul-count';
  homeStatus.textContent = '';
  if (state.home.teamFouls >= 5) {
    homeCount.classList.add('penalty');
    homeStatus.textContent = 'PENALTY';
  } else if (state.home.teamFouls >= 4) {
    homeCount.classList.add('bonus');
    homeStatus.textContent = 'BONUS';
  }

  awayCount.className = 'foul-count';
  awayStatus.textContent = '';
  if (state.away.teamFouls >= 5) {
    awayCount.classList.add('penalty');
    awayStatus.textContent = 'PENALTY';
  } else if (state.away.teamFouls >= 4) {
    awayCount.classList.add('bonus');
    awayStatus.textContent = 'BONUS';
  }
}

/* ── TIMEOUTS ── */
function toggleTimeout(team, index) {
  state[team].timeouts[index] = !state[team].timeouts[index];
  renderTimeouts(team);
  saveState();
}

function useTimeout(team) {
  // Find first available timeout
  var index = -1;
  for (var i = 0; i < 5; i++) {
    if (!state[team].timeouts[i]) {
      index = i;
      break;
    }
  }

  if (index === -1) {
    var teamName = team === 'home' ? state.homeName : state.awayName;
    showToast(teamName + ' has no timeouts remaining', 'warning');
    return;
  }

  state[team].timeouts[index] = true;
  renderTimeouts(team);
  saveState();

  var teamName = team === 'home' ? state.homeName : state.awayName;
  var remaining = 4 - index;
  showToast(teamName + ' timeout called (' + remaining + ' remaining)', 'success');
}

function renderTimeouts(team) {
  for (var i = 0; i < 5; i++) {
    var dot = document.getElementById(team + 'Timeout' + i);
    if (state[team].timeouts[i]) {
      dot.classList.add('used');
    } else {
      dot.classList.remove('used');
    }
  }
}

/* ── TEAM NAMES ── */
function initTeamNames() {
  var homeInput = document.getElementById('homeName');
  var awayInput = document.getElementById('awayName');
  homeInput.value = state.homeName;
  awayInput.value = state.awayName;
  homeInput.addEventListener('input', function() {
    state.homeName = homeInput.value || 'HOME';
    document.getElementById('homePanelTitle').textContent = state.homeName + ' ROSTER';
    document.getElementById('statsHomeBtn').textContent = state.homeName;
    saveState();
  });
  awayInput.addEventListener('input', function() {
    state.awayName = awayInput.value || 'AWAY';
    document.getElementById('awayPanelTitle').textContent = state.awayName + ' ROSTER';
    document.getElementById('statsAwayBtn').textContent = state.awayName;
    saveState();
  });
}

/* ── PLAYERS ── */
function addPlayer(team) {
  var nameInput = document.getElementById(team + 'PlayerName');
  var numInput = document.getElementById(team + 'PlayerNum');
  var name = nameInput.value.trim();
  var num = numInput.value.trim();

  if (!name) {
    showToast('Please enter a player name', 'error');
    nameInput.focus();
    return;
  }

  if (!num) {
    showToast('Please enter a jersey number', 'warning');
    numInput.focus();
    return;
  }

  state[team].players.push(makePlayer(name, num));
  nameInput.value = '';
  numInput.value = '';
  nameInput.focus();
  renderPlayers(team);
  renderStats();
  saveState();

  var teamName = team === 'home' ? state.homeName : state.awayName;
  showToast('#' + num + ' ' + name + ' added to ' + teamName, 'success');
}

function removePlayer(team, index) {
  if (state.activePlayer && state.activePlayer.team === team && state.activePlayer.index === index) {
    state.activePlayer = null;
  } else if (state.activePlayer && state.activePlayer.team === team && state.activePlayer.index > index) {
    state.activePlayer.index--;
  }
  state[team].players.splice(index, 1);
  renderPlayers(team);
  renderStats();
  updateActiveIndicator();
  saveState();
}

function selectPlayer(team, index) {
  if (state.activePlayer && state.activePlayer.team === team && state.activePlayer.index === index) {
    state.activePlayer = null;
  } else {
    state.activePlayer = { team: team, index: index };
  }
  renderPlayers('home');
  renderPlayers('away');
  updateActiveIndicator();
  saveState();
}

function renderPlayers(team) {
  var list = document.getElementById(team + 'PlayerList');
  list.innerHTML = '';
  state[team].players.forEach(function(p, i) {
    var isActive = state.activePlayer && state.activePlayer.team === team && state.activePlayer.index === i;
    var div = document.createElement('div');
    div.className = 'player-item' + (isActive ? ' active' : '');
    div.onclick = function(e) {
      if (e.target.classList.contains('btn-remove')) return;
      selectPlayer(team, i);
    };
    div.innerHTML =
      '<span class="player-jersey">' + esc(p.number) + '</span>' +
      '<span class="player-name">' + esc(p.name) + '</span>' +
      '<span class="player-pts">' + p.pts + '<span>PTS</span></span>' +
      '<button class="btn-remove" onclick="event.stopPropagation();removePlayer(\'' + team + '\',' + i + ')" aria-label="Remove player">&times;</button>';
    list.appendChild(div);
  });
}

function updateActiveIndicator() {
  var indicator = document.getElementById('activeIndicator');
  var warning = document.getElementById('noPlayerWarning');
  if (state.activePlayer) {
    var p = state[state.activePlayer.team].players[state.activePlayer.index];
    if (p) {
      var teamLabel = state.activePlayer.team === 'home' ? state.homeName : state.awayName;
      document.getElementById('activePlayerDisplay').textContent = '#' + p.number + ' ' + p.name + ' (' + teamLabel + ')';
      indicator.classList.add('show');
      warning.style.display = 'none';
    } else {
      state.activePlayer = null;
      indicator.classList.remove('show');
      warning.style.display = '';
    }
  } else {
    indicator.classList.remove('show');
    warning.style.display = '';
  }
}

/* ── ACTIONS ── */
function recordAction(type) {
  if (!state.activePlayer) {
    showToast('Please select a player first', 'error');
    return;
  }
  var team = state.activePlayer.team;
  var index = state.activePlayer.index;
  var player = state[team].players[index];
  if (!player) return;

  var action = { team: team, index: index, type: type, timestamp: Date.now() };
  var points = 0;

  switch (type) {
    case 'pts2': player.pts2++; player.pts += 2; points = 2; break;
    case 'pts3': player.pts3++; player.pts += 3; points = 3; break;
    case 'ft':   player.ft++;  player.pts += 1; points = 1; break;
    case 'miss2': player.miss2++; break;
    case 'miss3': player.miss3++; break;
    case 'missft': player.missft++; break;
    case 'ast':  player.ast++; break;
    case 'oreb': player.oreb++; break;
    case 'dreb': player.dreb++; break;
    case 'stl':  player.stl++; break;
    case 'blk':  player.blk++; break;
    case 'to':   player.to++; break;
    case 'fls':
      player.fls++;
      if (state[team].teamFouls < 5) {
        state[team].teamFouls++;
      }
      updateTeamFouls();

      // Warning when reaching team foul limit
      if (state[team].teamFouls === 5) {
        var teamName = team === 'home' ? state.homeName : state.awayName;
        setTimeout(function() {
          showToast(teamName + ' has reached 5 team fouls - PENALTY!', 'warning');
        }, 500);
      }
      break;
  }

  if (points > 0) {
    state[team].score += points;
    action.points = points;
    flashScore(team);
  }

  state.history.push(action);
  updateScores();
  renderPlayers(team);
  renderStats();
  saveState();

  var labels = {
    pts2: '+2 pts', pts3: '+3 pts', ft: '+1 FT',
    miss2: 'Miss 2PT', miss3: 'Miss 3PT', missft: 'Miss FT',
    ast: '+1 ast', oreb: '+1 oreb', dreb: '+1 dreb',
    stl: '+1 stl', blk: '+1 blk', to: '+1 TO', fls: '+1 foul'
  };
  showToast(labels[type] + ' \u2014 #' + player.number + ' ' + player.name);
}

function undoAction() {
  if (state.history.length === 0) {
    showToast('Nothing to undo', 'warning');
    return;
  }
  var action = state.history.pop();
  var player = state[action.team].players[action.index];
  if (!player) { saveState(); return; }

  switch (action.type) {
    case 'pts2': player.pts2--; player.pts -= 2; state[action.team].score -= 2; break;
    case 'pts3': player.pts3--; player.pts -= 3; state[action.team].score -= 3; break;
    case 'ft':   player.ft--;  player.pts -= 1; state[action.team].score -= 1; break;
    case 'miss2': player.miss2--; break;
    case 'miss3': player.miss3--; break;
    case 'missft': player.missft--; break;
    case 'ast':  player.ast--; break;
    case 'oreb': player.oreb--; break;
    case 'dreb': player.dreb--; break;
    case 'stl':  player.stl--; break;
    case 'blk':  player.blk--; break;
    case 'to':   player.to--; break;
    case 'fls':
      player.fls--;
      if (state[action.team].teamFouls > 0) {
        state[action.team].teamFouls--;
      }
      updateTeamFouls();
      break;
  }

  updateScores();
  renderPlayers('home');
  renderPlayers('away');
  renderStats();
  saveState();
  showToast('Undone: ' + action.type);
}

/* ── NEW GAME ── */
function confirmNewGame() {
  document.getElementById('confirmModal').classList.add('show');
}

function closeModal() {
  document.getElementById('confirmModal').classList.remove('show');
}

function newGame() {
  closeModal();

  // Reset scores and game state
  state.home.score = 0;
  state.away.score = 0;
  state.home.timeouts = [false,false,false,false,false];
  state.away.timeouts = [false,false,false,false,false];
  state.home.teamFouls = 0;
  state.away.teamFouls = 0;
  state.periodIndex = 0;
  state.history = [];
  state.activePlayer = null;

  // Clear all players
  state.home.players = [];
  state.away.players = [];

  // Reset team names
  state.homeName = 'HOME';
  state.awayName = 'AWAY';
  document.getElementById('homeName').value = 'HOME';
  document.getElementById('awayName').value = 'AWAY';
  document.getElementById('homePanelTitle').textContent = 'HOME ROSTER';
  document.getElementById('awayPanelTitle').textContent = 'AWAY ROSTER';
  document.getElementById('statsHomeBtn').textContent = 'HOME';
  document.getElementById('statsAwayBtn').textContent = 'AWAY';

  // Update all UI elements
  updateScores();
  updatePeriod();
  renderPlayers('home');
  renderPlayers('away');
  renderStats();
  updateActiveIndicator();
  renderTimeouts('home');
  renderTimeouts('away');
  updateTeamFouls();

  // Save the reset state
  saveState();

  showToast('New game started — all data cleared', 'success');
}

/* ── SCORES ── */
function updateScores() {
  document.getElementById('homeScore').textContent = state.home.score;
  document.getElementById('awayScore').textContent = state.away.score;
}

function flashScore(team) {
  var el = document.getElementById(team + 'Score');
  el.classList.add('flash');
  setTimeout(function() { el.classList.remove('flash'); }, 200);
}

/* ── STATS TABLE ── */
function showStats(team, btn) {
  state.statsView = team;
  document.querySelectorAll('.stats-toggle button').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderStats();
}

function renderStats() {
  var tbody = document.getElementById('statsBody');
  var view = state.statsView;
  tbody.innerHTML = '';

  if (view === 'both') {
    // Show both teams
    renderTeamStats('home', tbody, true);
    renderTeamStats('away', tbody, true);
  } else {
    // Show single team
    var players = state[view].players;
    if (players.length === 0) {
      tbody.innerHTML = '<tr><td colspan="17" style="text-align:center;color:var(--text-dim);padding:20px;font-style:italic">No players added yet</td></tr>';
      return;
    }
    renderTeamStats(view, tbody, false);
  }
}

function renderTeamStats(team, tbody, addHeader) {
  var players = state[team].players;
  var teamName = team === 'home' ? state.homeName : state.awayName;

  if (players.length === 0 && addHeader) {
    return; // Skip empty teams in both view
  }

  // Add team header for "both" view
  if (addHeader) {
    var headerRow = document.createElement('tr');
    headerRow.className = 'team-header-row';
    headerRow.innerHTML = '<td colspan="17" style="text-align:left;font-weight:700;font-size:.9rem;color:var(--orange);padding:10px 8px;background:var(--surface2)">' + teamName + ' (Score: ' + state[team].score + ')</td>';
    tbody.appendChild(headerRow);
  }

  var totals = { pts: 0, pts2: 0, pts3: 0, ft: 0, miss2: 0, miss3: 0, missft: 0, ast: 0, oreb: 0, dreb: 0, stl: 0, blk: 0, to: 0, fls: 0 };

  players.forEach(function(p) {
    var fgm = p.pts2 + p.pts3;
    var fga = fgm + p.miss2 + p.miss3;
    var tpm = p.pts3;
    var tpa = p.pts3 + p.miss3;
    var ftm = p.ft;
    var fta = p.ft + p.missft;
    var reb = p.oreb + p.dreb;

    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(p.name) + '</td>' +
      '<td>' + esc(p.number) + '</td>' +
      '<td><strong>' + p.pts + '</strong></td>' +
      '<td>' + fgm + '</td>' +
      '<td>' + fga + '</td>' +
      '<td>' + tpm + '</td>' +
      '<td>' + tpa + '</td>' +
      '<td>' + ftm + '</td>' +
      '<td>' + fta + '</td>' +
      '<td>' + p.oreb + '</td>' +
      '<td>' + p.dreb + '</td>' +
      '<td>' + reb + '</td>' +
      '<td>' + p.ast + '</td>' +
      '<td>' + p.stl + '</td>' +
      '<td>' + p.blk + '</td>' +
      '<td>' + p.to + '</td>' +
      '<td>' + p.fls + '</td>';
    tbody.appendChild(tr);
    for (var k in totals) totals[k] += p[k];
  });

  var totalFgm = totals.pts2 + totals.pts3;
  var totalFga = totalFgm + totals.miss2 + totals.miss3;
  var totalTpm = totals.pts3;
  var totalTpa = totals.pts3 + totals.miss3;
  var totalFtm = totals.ft;
  var totalFta = totals.ft + totals.missft;
  var totalReb = totals.oreb + totals.dreb;

  var tr = document.createElement('tr');
  tr.className = 'totals-row';
  tr.innerHTML =
    '<td>TOTALS</td>' +
    '<td></td>' +
    '<td><strong>' + totals.pts + '</strong></td>' +
    '<td>' + totalFgm + '</td>' +
    '<td>' + totalFga + '</td>' +
    '<td>' + totalTpm + '</td>' +
    '<td>' + totalTpa + '</td>' +
    '<td>' + totalFtm + '</td>' +
    '<td>' + totalFta + '</td>' +
    '<td>' + totals.oreb + '</td>' +
    '<td>' + totals.dreb + '</td>' +
    '<td>' + totalReb + '</td>' +
    '<td>' + totals.ast + '</td>' +
    '<td>' + totals.stl + '</td>' +
    '<td>' + totals.blk + '</td>' +
    '<td>' + totals.to + '</td>' +
    '<td>' + totals.fls + '</td>';
  tbody.appendChild(tr);
}

/* ── EXPORT CSV ── */
function exportCSV() {
  var lines = [];
  var date = new Date().toISOString().slice(0, 10);
  var period = getPeriodLabel();

  lines.push('Basketball Game Stats - ' + date);
  lines.push(state.homeName + ' ' + state.home.score + ' vs ' + state.away.score + ' ' + state.awayName + ' (' + period + ')');
  lines.push('');

  ['home', 'away'].forEach(function(team) {
    var teamName = team === 'home' ? state.homeName : state.awayName;
    var players = state[team].players;
    lines.push(teamName + ' (Score: ' + state[team].score + ')');
    lines.push('Player,#,PTS,FGM,FGA,3PM,3PA,FTM,FTA,OREB,DREB,REB,AST,STL,BLK,TO,FLS');

    var totals = { pts: 0, pts2: 0, pts3: 0, ft: 0, miss2: 0, miss3: 0, missft: 0, ast: 0, oreb: 0, dreb: 0, stl: 0, blk: 0, to: 0, fls: 0 };
    players.forEach(function(p) {
      var fgm = p.pts2 + p.pts3;
      var fga = fgm + p.miss2 + p.miss3;
      var tpm = p.pts3;
      var tpa = p.pts3 + p.miss3;
      var ftm = p.ft;
      var fta = p.ft + p.missft;
      var reb = p.oreb + p.dreb;
      lines.push(csvSafe(p.name) + ',' + csvSafe(p.number) + ',' + p.pts + ',' + fgm + ',' + fga + ',' + tpm + ',' + tpa + ',' + ftm + ',' + fta + ',' + p.oreb + ',' + p.dreb + ',' + reb + ',' + p.ast + ',' + p.stl + ',' + p.blk + ',' + p.to + ',' + p.fls);
      for (var k in totals) totals[k] += p[k];
    });
    var totalFgm = totals.pts2 + totals.pts3;
    var totalFga = totalFgm + totals.miss2 + totals.miss3;
    var totalTpm = totals.pts3;
    var totalTpa = totals.pts3 + totals.miss3;
    var totalFtm = totals.ft;
    var totalFta = totals.ft + totals.missft;
    var totalReb = totals.oreb + totals.dreb;
    lines.push('TOTALS,,' + totals.pts + ',' + totalFgm + ',' + totalFga + ',' + totalTpm + ',' + totalTpa + ',' + totalFtm + ',' + totalFta + ',' + totals.oreb + ',' + totals.dreb + ',' + totalReb + ',' + totals.ast + ',' + totals.stl + ',' + totals.blk + ',' + totals.to + ',' + totals.fls);
    lines.push('');
  });

  var csv = lines.join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'basketball-stats-' + date + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Stats exported as CSV', 'success');
}

function csvSafe(str) {
  str = String(str);
  if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/* ── EXPORT PDF (Print-ready game report) ── */
function exportPDF() {
  var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  var period = getPeriodLabel();
  var homeWin = state.home.score > state.away.score;
  var awayWin = state.away.score > state.home.score;
  var tied = state.home.score === state.away.score;

  function buildTeamTable(team) {
    var teamName = team === 'home' ? state.homeName : state.awayName;
    var players = state[team].players;
    var totals = { pts: 0, pts2: 0, pts3: 0, ft: 0, miss2: 0, miss3: 0, missft: 0, ast: 0, oreb: 0, dreb: 0, stl: 0, blk: 0, to: 0, fls: 0 };
    var rows = '';
    players.forEach(function(p) {
      var fgm = p.pts2 + p.pts3;
      var fga = fgm + p.miss2 + p.miss3;
      var tpm = p.pts3;
      var tpa = p.pts3 + p.miss3;
      var ftm = p.ft;
      var fta = p.ft + p.missft;
      var reb = p.oreb + p.dreb;
      rows += '<tr>' +
        '<td style="text-align:left;font-weight:500">' + esc(p.name) + '</td>' +
        '<td style="color:#e8792b;font-weight:700">' + esc(p.number) + '</td>' +
        '<td style="font-weight:700">' + p.pts + '</td>' +
        '<td>' + fgm + '</td><td>' + fga + '</td>' +
        '<td>' + tpm + '</td><td>' + tpa + '</td>' +
        '<td>' + ftm + '</td><td>' + fta + '</td>' +
        '<td>' + p.oreb + '</td><td>' + p.dreb + '</td><td>' + reb + '</td>' +
        '<td>' + p.ast + '</td><td>' + p.stl + '</td><td>' + p.blk + '</td>' +
        '<td>' + p.to + '</td><td>' + p.fls + '</td></tr>';
      for (var k in totals) totals[k] += p[k];
    });
    var totalFgm = totals.pts2 + totals.pts3;
    var totalFga = totalFgm + totals.miss2 + totals.miss3;
    var totalTpm = totals.pts3;
    var totalTpa = totals.pts3 + totals.miss3;
    var totalFtm = totals.ft;
    var totalFta = totals.ft + totals.missft;
    var totalReb = totals.oreb + totals.dreb;
    rows += '<tr style="font-weight:700;border-top:2px solid #e8792b;color:#e8792b;background:#e8792b0a">' +
      '<td style="text-align:left">TOTALS</td><td></td>' +
      '<td>' + totals.pts + '</td><td>' + totalFgm + '</td><td>' + totalFga + '</td>' +
      '<td>' + totalTpm + '</td><td>' + totalTpa + '</td>' +
      '<td>' + totalFtm + '</td><td>' + totalFta + '</td>' +
      '<td>' + totals.oreb + '</td><td>' + totals.dreb + '</td><td>' + totalReb + '</td>' +
      '<td>' + totals.ast + '</td><td>' + totals.stl + '</td><td>' + totals.blk + '</td>' +
      '<td>' + totals.to + '</td><td>' + totals.fls + '</td></tr>';

    return '<div style="margin-bottom:28px">' +
      '<h2 style="font-family:sans-serif;font-size:16px;color:#e8792b;margin:0 0 8px;letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #e8792b;padding-bottom:4px">' + esc(teamName) + ' &mdash; ' + state[team].score + ' PTS</h2>' +
      '<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:sans-serif">' +
      '<thead><tr style="background:#f5f5f5;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888">' +
      '<th style="text-align:left;padding:5px 6px">Player</th><th style="padding:5px 4px">#</th>' +
      '<th style="padding:5px 4px">PTS</th><th style="padding:5px 4px">FGM</th><th style="padding:5px 4px">FGA</th>' +
      '<th style="padding:5px 4px">3PM</th><th style="padding:5px 4px">3PA</th>' +
      '<th style="padding:5px 4px">FTM</th><th style="padding:5px 4px">FTA</th>' +
      '<th style="padding:5px 4px">OR</th><th style="padding:5px 4px">DR</th><th style="padding:5px 4px">REB</th>' +
      '<th style="padding:5px 4px">AST</th><th style="padding:5px 4px">STL</th><th style="padding:5px 4px">BLK</th>' +
      '<th style="padding:5px 4px">TO</th><th style="padding:5px 4px">FLS</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  var resultText = tied ? 'TIE GAME' : (homeWin ? esc(state.homeName) + ' WIN' : esc(state.awayName) + ' WIN');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<title>Game Report - ' + esc(state.homeName) + ' vs ' + esc(state.awayName) + '</title>' +
    '<style>' +
    '@media print { @page { margin: 0.5in; size: letter; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }' +
    'body { font-family: -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 40px; color: #222; background: #fff; }' +
    'table td, table th { padding: 4px 6px; text-align: center; border-bottom: 1px solid #eee; }' +
    '</style></head><body>' +

    // Header
    '<div style="text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #e8792b">' +
    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#888;margin-bottom:6px">Basketball Game Report</div>' +
    '<div style="font-size:11px;color:#aaa;margin-bottom:16px">' + date + ' &bull; Period: ' + period + '</div>' +

    // Scoreboard
    '<div style="display:flex;align-items:center;justify-content:center;gap:24px;margin:0 auto">' +
    '<div style="text-align:center;min-width:120px">' +
    '<div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px">' + esc(state.homeName) + '</div>' +
    '<div style="font-size:56px;font-weight:800;line-height:1;color:' + (homeWin ? '#e8792b' : '#222') + '">' + state.home.score + '</div>' +
    '</div>' +
    '<div style="font-size:14px;color:#ccc;font-weight:300;letter-spacing:3px">VS</div>' +
    '<div style="text-align:center;min-width:120px">' +
    '<div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px">' + esc(state.awayName) + '</div>' +
    '<div style="font-size:56px;font-weight:800;line-height:1;color:' + (awayWin ? '#e8792b' : '#222') + '">' + state.away.score + '</div>' +
    '</div>' +
    '</div>' +

    '<div style="margin-top:12px;font-size:13px;font-weight:700;color:#e8792b;letter-spacing:2px;text-transform:uppercase">' + resultText + '</div>' +
    '</div>' +

    // Box scores
    buildTeamTable('home') +
    buildTeamTable('away') +

    // Footer
    '<div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#bbb;letter-spacing:1px">Generated by Basketball Scorer</div>' +

    '<script>window.onload=function(){window.print()}<\/script>' +
    '</body></html>';

  var win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    showToast('Game report opened — save as PDF from print dialog', 'success');
  } else {
    showToast('Pop-up blocked — please allow pop-ups', 'error');
  }
}

/* ══════════════════════════════════════════
   SPOTLIGHT TUTORIAL
   ══════════════════════════════════════════ */

var tutorialSteps = [
  {
    target: '.scoreboard',
    title: 'Welcome! 👋',
    text: 'Basketball Scorer by John Patrick Haguimit. A courtside scoring app for tracking live games. Check the footer for more projects!',
    tip: 'This tutorial will guide you through all features. Let\'s get started!',
    position: 'bottom'
  },
  {
    target: '.scoreboard',
    title: 'Scoreboard & Timeouts',
    text: 'This is your live scoreboard. Click team names to rename them. Scores update automatically. Click timeout dots below each team to track timeouts used.',
    tip: 'Tap "HOME" or "AWAY" right now to type your team name.',
    position: 'bottom'
  },
  {
    target: '.center-info',
    title: 'Period Tracker',
    text: 'Track the current quarter or overtime period here. Use the Prev/Next buttons to advance through the game.',
    tip: 'Periods go Q1 \u2192 Q2 \u2192 Q3 \u2192 Q4 \u2192 OT1 \u2192 OT2 and so on.',
    position: 'bottom'
  },
  {
    target: '#homePanel',
    title: 'Add Players',
    text: 'Type a player\'s name and jersey number, then hit Add (or press Enter). Build your roster before the game starts.',
    tip: 'You can add players for both teams. Rosters are saved even after a new game.',
    position: 'bottom'
  },
  {
    target: '#homePlayerList',
    title: 'Select a Player',
    text: 'Tap any player to select them. They\'ll glow orange \u2014 all stat actions will apply to the selected player.',
    tip: 'Tap the same player again to deselect. Switch between teams freely.',
    position: 'bottom',
    fallback: '#homePanel'
  },
  {
    target: '.action-grid',
    title: 'Record Actions',
    text: 'With a player selected, tap these buttons to record points, misses, rebounds (off/def), assists, steals, blocks, turnovers, and fouls.',
    tip: 'Scoring buttons automatically update both the player\'s stats and the team score.',
    position: 'top'
  },
  {
    target: '.undo-btn',
    title: 'Undo Mistakes',
    text: 'Made an error? This button reverses the last recorded action instantly.',
    tip: 'You can undo multiple times in a row.',
    position: 'top'
  },
  {
    target: '.stats-section',
    title: 'Box Score',
    text: 'Full player stats are shown here with FG%, 3P%, offensive/defensive rebounds, turnovers, and more. Toggle between Home and Away teams.',
    tip: 'Export as CSV for spreadsheets, or PDF for a printable game report.',
    position: 'top'
  }
];

var tutorialStep = 0;
var tutorialActive = false;

function showTutorial() {
  tutorialStep = 0;
  tutorialActive = true;
  document.getElementById('tutorialBackdrop').classList.add('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(function() { positionSpotlight(); }, 100);
}

function closeTutorial() {
  tutorialActive = false;
  document.getElementById('tutorialBackdrop').classList.remove('show');
  document.getElementById('tutorialTooltip').classList.remove('show');
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch(e) {}
}

function nextTutorialStep() {
  tutorialStep++;
  if (tutorialStep >= tutorialSteps.length) {
    closeTutorial();
    showToast('Tutorial complete — you\'re ready to score!', 'success');
    return;
  }
  positionSpotlight();
}

function prevTutorialStep() {
  if (tutorialStep > 0) {
    tutorialStep--;
    positionSpotlight();
  }
}

function positionSpotlight() {
  var step = tutorialSteps[tutorialStep];
  var targetEl = document.querySelector(step.target);

  // Fallback if target doesn't exist or is empty
  if ((!targetEl || targetEl.offsetHeight === 0) && step.fallback) {
    targetEl = document.querySelector(step.fallback);
  }
  if (!targetEl) return;

  // Scroll target into view
  var elRect = targetEl.getBoundingClientRect();
  var needsScroll = elRect.top < 0 || elRect.bottom > window.innerHeight;
  if (needsScroll) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function() { placeElements(targetEl, step); }, 400);
  } else {
    placeElements(targetEl, step);
  }
}

function placeElements(targetEl, step) {
  var rect = targetEl.getBoundingClientRect();
  var pad = 8;

  // Position spotlight hole
  var hole = document.getElementById('spotlightHole');
  hole.style.top = (rect.top + window.scrollY - pad) + 'px';
  hole.style.left = (rect.left - pad) + 'px';
  hole.style.width = (rect.width + pad * 2) + 'px';
  hole.style.height = (rect.height + pad * 2) + 'px';

  // Build dots
  var dotsHtml = '';
  for (var i = 0; i < tutorialSteps.length; i++) {
    var cls = 'dot';
    if (i === tutorialStep) cls += ' active';
    else if (i < tutorialStep) cls += ' done';
    dotsHtml += '<span class="' + cls + '"></span>';
  }
  document.getElementById('tutorialDots').innerHTML = dotsHtml;

  // Fill content
  document.getElementById('tooltipTitle').textContent = step.title;
  document.getElementById('tooltipText').textContent = step.text;
  document.getElementById('tooltipTip').textContent = step.tip;

  var isFirst = tutorialStep === 0;
  var isLast = tutorialStep === tutorialSteps.length - 1;
  document.getElementById('tutorialNav').innerHTML =
    (isFirst
      ? '<button class="btn-skip" onclick="closeTutorial()">Skip</button>'
      : '<button class="btn-skip" onclick="prevTutorialStep()">Back</button>') +
    '<span class="tutorial-step-counter">' + (tutorialStep + 1) + '/' + tutorialSteps.length + '</span>' +
    '<button class="btn-next" onclick="nextTutorialStep()">' + (isLast ? 'Done' : 'Next') + '</button>';

  // Position tooltip
  var tooltip = document.getElementById('tutorialTooltip');
  var arrow = document.getElementById('tooltipArrow');
  tooltip.classList.remove('show');
  arrow.className = 'tooltip-arrow';

  // Reset for measurement
  tooltip.style.top = '0';
  tooltip.style.left = '0';
  tooltip.classList.add('show');
  var ttRect = tooltip.getBoundingClientRect();

  var ttLeft = rect.left + rect.width / 2 - ttRect.width / 2;
  // Clamp horizontal
  ttLeft = Math.max(8, Math.min(ttLeft, window.innerWidth - ttRect.width - 8));
  var arrowLeft = rect.left + rect.width / 2 - ttLeft - 7;
  arrowLeft = Math.max(16, Math.min(arrowLeft, ttRect.width - 30));

  if (step.position === 'bottom') {
    var ttTop = rect.bottom + window.scrollY + pad + 14;
    tooltip.style.top = ttTop + 'px';
    tooltip.style.left = ttLeft + 'px';
    arrow.classList.add('top');
    arrow.style.left = arrowLeft + 'px';
    arrow.style.top = '';
    arrow.style.bottom = '';
  } else {
    var ttTop2 = rect.top + window.scrollY - ttRect.height - pad - 14;
    if (ttTop2 < window.scrollY + 8) {
      ttTop2 = rect.bottom + window.scrollY + pad + 14;
      arrow.classList.add('top');
    } else {
      arrow.classList.add('bottom');
    }
    tooltip.style.top = ttTop2 + 'px';
    tooltip.style.left = ttLeft + 'px';
    arrow.style.left = arrowLeft + 'px';
    arrow.style.top = '';
    arrow.style.bottom = '';
  }
}

// Reposition on scroll/resize
var repositionTimer;
function onRepositionNeeded() {
  if (!tutorialActive) return;
  clearTimeout(repositionTimer);
  repositionTimer = setTimeout(function() { positionSpotlight(); }, 100);
}
window.addEventListener('resize', onRepositionNeeded);
window.addEventListener('scroll', onRepositionNeeded);

// Click backdrop to advance
document.addEventListener('click', function(e) {
  if (!tutorialActive) return;
  var backdrop = document.getElementById('tutorialBackdrop');
  if (e.target === backdrop) {
    nextTutorialStep();
  }
});

/* ── UTILITIES ── */
function esc(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(msg, type) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;

  // Remove all type classes
  toast.classList.remove('error', 'success', 'warning');

  // Add type class if specified
  if (type) {
    toast.classList.add(type);
  }

  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(function() {
    toast.classList.remove('show');
  }, 2500);
}

function setupEnterKey(team) {
  var nameInput = document.getElementById(team + 'PlayerName');
  var numInput = document.getElementById(team + 'PlayerNum');
  [nameInput, numInput].forEach(function(input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addPlayer(team);
    });
  });
}

/* ── INIT ── */
function init() {
  loadState();
  initTeamNames();
  updateScores();
  updatePeriod();
  renderPlayers('home');
  renderPlayers('away');
  updateActiveIndicator();
  renderTimeouts('home');
  renderTimeouts('away');
  updateTeamFouls();
  showStats(state.statsView);
  setupEnterKey('home');
  setupEnterKey('away');

  document.getElementById('homePanelTitle').textContent = state.homeName + ' ROSTER';
  document.getElementById('awayPanelTitle').textContent = state.awayName + ' ROSTER';
  document.getElementById('statsHomeBtn').textContent = state.homeName;
  document.getElementById('statsAwayBtn').textContent = state.awayName;

  if (state.statsView === 'away') {
    document.getElementById('statsHomeBtn').classList.remove('active');
    document.getElementById('statsAwayBtn').classList.add('active');
    document.getElementById('statsBothBtn').classList.remove('active');
  } else if (state.statsView === 'both') {
    document.getElementById('statsHomeBtn').classList.remove('active');
    document.getElementById('statsAwayBtn').classList.remove('active');
    document.getElementById('statsBothBtn').classList.add('active');
  }

  // Show tutorial on first visit
  try {
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      setTimeout(showTutorial, 500);
    }
  } catch(e) {}
}

init();

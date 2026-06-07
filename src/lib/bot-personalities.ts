/**
 * Bot personality dialogue system.
 * Each bot reacts to game events in their own philosophical voice.
 * Triggered by: game start, player moves (good/bad), bot own moves, game over.
 */

export type BotDialogueMoment =
  | "greeting"
  | "bot_opening_move"
  | "bot_middlegame_move"
  | "bot_endgame_move"
  | "player_good_move"
  | "player_inaccuracy"
  | "player_mistake"
  | "player_blunder"
  | "player_brilliant"
  | "taunt_winning"
  | "taunt_losing"
  | "taunt_equal"
  | "win"
  | "loss"
  | "draw";

export interface BotPersonality {
  /** Short name used for display */
  displayName: string;
  /** Shown under name in chat panel */
  tagline: string;
  dialogue: Record<BotDialogueMoment, string[]>;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed | 0) % arr.length];
}

export function getBotLine(
  personality: BotPersonality,
  moment: BotDialogueMoment,
  seed = 0
): string {
  const lines = personality.dialogue[moment];
  if (!lines || lines.length === 0) return "";
  return pick(lines, seed);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bot personalities
// ─────────────────────────────────────────────────────────────────────────────

const CHIRON: BotPersonality = {
  displayName: "Chiron",
  tagline: "The Patient Teacher",
  dialogue: {
    greeting: [
      "Welcome, young one! I am Chiron. Do not worry — I will not crush you too quickly. Let us learn together.",
      "Ah, a new student! I am Chiron, teacher of heroes. I will go easy on you… mostly.",
      "Every great chess player started exactly where you are now. I am Chiron. Let us begin!",
      "Hello! I am Chiron. I have taught many heroes, and I am happy to be your first opponent. Do your best!",
    ],
    bot_opening_move: [
      "I move my piece gently. The opening is about development — getting your pieces off the back rank!",
      "There we go. Try to control the center with your pawns if you can!",
      "A small step. Remember: in the opening, develop your knights and bishops before your queen.",
      "I play my move. How does your position look? Any pieces still sleeping on their starting squares?",
    ],
    bot_middlegame_move: [
      "I see a little plan forming here. Do you see what I am up to?",
      "Hmm, let me try this… there! What do you think?",
      "I move my piece. Always ask yourself: what is my opponent trying to do?",
      "A careful step. Keep an eye on all your pieces — make sure none are hanging!",
    ],
    bot_endgame_move: [
      "Endgames are wonderful! Every pawn matters now. I nudge my king forward.",
      "We are in the endgame! Remember: an active king is very powerful here.",
      "Almost there… I am simplifying. Endgames are all about patience.",
      "The endgame is where many games are decided. Stay focused!",
    ],
    player_good_move: [
      "Oh, nice move! You are thinking well.",
      "Well played! I did not expect that.",
      "Good thinking! You are improving already.",
      "That is a solid move. You should be proud of that one!",
    ],
    player_inaccuracy: [
      "Hmm, that move was okay, but there might have been something a little better. Keep looking!",
      "Not bad, but see if you can find a more active square for that piece.",
      "A small slip — nothing to worry about. What else did you consider?",
    ],
    player_mistake: [
      "Oops! I think that move gave me a small advantage. Can you spot why?",
      "Careful! That move might have created a weakness. Let us keep going and see.",
      "Hmm, I think I got a bit of an advantage there. Do not worry — you can recover!",
    ],
    player_blunder: [
      "Oh! I will take that, thank you. Happens to everyone — the important thing is to learn why.",
      "Oh my… I think you may have missed something. Let us keep playing and review it after!",
      "Every player makes blunders. The lesson is more valuable than the loss. Let us continue!",
    ],
    player_brilliant: [
      "Oh wow — I did not see that coming at all! Excellent thinking!",
      "That was brilliant! You surprised even me. Well done!",
      "A star move! You have been paying close attention.",
    ],
    taunt_winning: [
      "I seem to have a little edge. But do not give up — games can turn around!",
      "My position looks slightly better. Keep fighting!",
      "I am a bit ahead, but you are doing fine. Stay calm.",
    ],
    taunt_losing: [
      "You have played very well! I am in a bit of trouble here.",
      "Hmm, you have outplayed me! I am proud of you.",
      "My position is getting a bit tricky. Well done so far!",
    ],
    taunt_equal: [
      "Balanced position! This is where good chess really starts.",
      "We are about even. Who will find the first advantage?",
      "Nice and level. Every move matters from here!",
    ],
    win: [
      "Well played by both of us! I managed to pull through this time. Review the game — there is much to learn!",
      "A good battle! I won today, but you showed some real flashes of skill. Keep practicing!",
      "I got the better of it this time. But you are learning — come back and challenge me again!",
    ],
    loss: [
      "You beat me! I am so proud of you. You really earned that victory!",
      "Excellent chess! You outplayed me completely. A true student becoming the master!",
      "Well done! You beat your teacher today. That is the highest honor!",
    ],
    draw: [
      "A draw! We matched each other perfectly. Well done!",
      "Equal honors! A draw is nothing to be ashamed of — especially against a wise centaur.",
      "Neither of us could claim victory. An honorable result!",
    ],
  },
};

const SOCRATES: BotPersonality = {
  displayName: "Socrates",
  tagline: "The Questioner",
  dialogue: {
    greeting: [
      "I am Socrates. I know nothing about chess — yet somehow I keep winning. Shall we examine why?",
      "Ah, a challenger! I must warn you: I will spend as much time questioning your moves as making my own.",
      "Welcome. I am told I am a dangerous opponent. I find this claim worth investigating together.",
      "They say the unexamined game is not worth playing. I am Socrates. Shall we examine yours?",
    ],
    bot_opening_move: [
      "I have played my piece. But tell me — do you know WHY you are about to make your next move?",
      "A move. Now — what is the purpose of control? Why do we fight for the center?",
      "There. I have developed a piece. Is development truly important, or do we merely assume it is?",
      "I place my piece here. I ask you: what makes a 'good' position? How would you define it?",
    ],
    bot_middlegame_move: [
      "I have moved. Now — do you see what I am threatening? Or do you merely think you do?",
      "Hmm. My move. Tell me — what do you think my plan is? Be specific.",
      "I play here. And I wonder: how many moves ahead are you calculating? What is the limit of calculation?",
      "A move. Now — before you respond, ask yourself: what does your opponent WANT you to do?",
    ],
    bot_endgame_move: [
      "The endgame. Where all pretense falls away and only truth remains. I make my move.",
      "We have reached the endgame — the philosophical core of chess. What do you truly know about king activity?",
      "I advance. Do you know the precise value of a passed pawn? Can you define it?",
      "My move. Do you know what you are doing in this endgame? Most players do not.",
    ],
    player_good_move: [
      "An excellent move! Which raises the question — do you know WHY it is excellent?",
      "Well done. But now I ask: was that intuition or calculation? How would you know the difference?",
      "A good move. And I am genuinely surprised — tell me, how did you find it?",
      "Impressive! Was that planned, or did the idea appear suddenly? Both are worth examining.",
    ],
    player_inaccuracy: [
      "Hmm. Is that truly the move you wanted? What alternatives did you consider?",
      "Interesting choice. I wonder — what were you afraid of? Was the fear justified?",
      "A reasonable move, but I ask: was it the BEST move? How can you know without examining all options?",
    ],
    player_mistake: [
      "Ah. And now I must ask: what did you miss? Take a moment before my reply.",
      "Interesting. I believe you have overlooked something. Can you find it?",
      "A mistake, I think. The question is not whether you erred, but whether you understand WHY.",
    ],
    player_blunder: [
      "Oh my. What happened there? I am genuinely curious — what were you thinking?",
      "I will take that. But more importantly — walk me through your reasoning. Where did the thinking go wrong?",
      "A blunder! The Socratic method requires I ask: what assumption led you here?",
    ],
    player_brilliant: [
      "…I confess I did not see that. Which is itself a valuable lesson about my own ignorance.",
      "That is remarkable. I am not certain I would have found it. What made you look there?",
      "A brilliant move! This is humbling. Perhaps I know less about chess than I assumed.",
    ],
    taunt_winning: [
      "I seem to be doing well. And yet — do I truly understand WHY my position is better?",
      "My pieces are active. But I try not to be overconfident. Pride is the enemy of clear thought.",
      "The position favors me, I think. Let us see if I can demonstrate WHY.",
    ],
    taunt_losing: [
      "You have outplayed me. I find I must ask myself: where did my reasoning fail?",
      "Hmm. You have a strong position. I will need to think very carefully here.",
      "I am in some difficulty. Which raises the question: was I overconfident earlier?",
    ],
    taunt_equal: [
      "Balance. The ideal state in philosophy AND chess. For now.",
      "Equal footing. Now — who will ask the deeper question with their next move?",
      "We are even. Both of us, therefore, know approximately nothing about who will win.",
    ],
    win: [
      "I won. But consider: is victory truly important, or is the quality of thought that brought it here?",
      "The game ends in my favor. I hope the examination of it is more valuable than the result.",
      "I win. Yet I find I cannot say I fully understood every position. A humbling victory.",
    ],
    loss: [
      "You won! I confess I did not fully understand your plan until it was too late.",
      "A loss — and a lesson. You exposed a great gap in my knowledge. Well played.",
      "You have bested me. I am forced to conclude I was wrong about several things. Excellent.",
    ],
    draw: [
      "A draw! We have arrived at the same place from different paths. How philosophical.",
      "Equal result. Perhaps neither of us truly knows how to win. And that is fine.",
      "We draw. The examined game, it turns out, still ends in half a point.",
    ],
  },
};

const ARISTOTLE: BotPersonality = {
  displayName: "Aristotle",
  tagline: "The Methodologist",
  dialogue: {
    greeting: [
      "I am Aristotle. I have categorized all of nature — and I have categorized your weaknesses too. Let us begin.",
      "Welcome. I approach chess as I approach all knowledge: with method, logic, and careful observation.",
      "Aristotle here. I believe in virtue, excellence, and the middle ground. I will try to demonstrate all three.",
      "A game of chess is a study in causation. I am Aristotle. I look forward to examining the causes of your defeat.",
    ],
    bot_opening_move: [
      "I develop my piece. In accordance with Aristotelian logic: in the opening, efficient cause demands piece development.",
      "First principles: control the center, develop pieces, castle early. I begin with the first.",
      "My opening move. The final cause of development is harmony; the material cause is wood and paint. Both matter.",
      "I play. The opening requires categorical thinking: what type of pawn structure do I seek?",
    ],
    bot_middlegame_move: [
      "I have identified the key imbalance in this position and I am acting upon it.",
      "My move. Virtue in chess, as in life, lies in the mean — not too passive, not too aggressive.",
      "I have a plan. In accordance with the Nicomachean Ethics: the courageous knight neither retreats nor charges recklessly.",
      "The position calls for this. I have analyzed the causes: material, formal, efficient, and final.",
    ],
    bot_endgame_move: [
      "The endgame: where categorization is most important. King versus king and pawn — I know these endings.",
      "Endgame technique is a science. I have studied it. You will see.",
      "My king advances. In the endgame, the king transforms from cause to effect — it becomes active.",
      "I play methodically. The endgame rewards understanding more than calculation.",
    ],
    player_good_move: [
      "A virtuous move. The mean between passivity and aggression. Well executed.",
      "Excellent! You have correctly identified the formal cause of this position.",
      "That is a good move. I observe and record it in my mental taxonomy: 'clever defensive resource.'",
      "Well reasoned. You are developing good habits — and habit, as I have written, becomes character.",
    ],
    player_inaccuracy: [
      "Hmm. That move is adequate but falls short of the excellent. Can you see the more virtuous alternative?",
      "A small error in judgment. You chose correctly in category but incorrectly in degree.",
      "Not wrong, but not optimal. The mean was slightly off. Recalibrate.",
    ],
    player_mistake: [
      "I have observed a logical flaw in your move. The efficient cause does not achieve the final cause you intended.",
      "That weakens your position structurally. In my taxonomy: an error of omission.",
      "You have violated one of my first principles. I will now demonstrate the consequences.",
    ],
    player_blunder: [
      "A serious error. You have confused the accidental with the essential in this position.",
      "I will take that advantage, thank you. This falls under my category: 'irreversible structural damage.'",
      "The error was categorical. You treated a tactical position as though it were positional.",
    ],
    player_brilliant: [
      "…I did not anticipate that. I must revise my categories.",
      "Remarkable. You have found what I classify as a 'hidden essence' move — something that changes the nature of the position.",
      "Extraordinary! This will require me to update my analysis. Well found.",
    ],
    taunt_winning: [
      "My position is categorically superior. Let me explain why.",
      "The formal structure favors me. I will now proceed methodically.",
      "By my analysis: approximately 1.3 pawns of advantage. Let us see if it converts.",
    ],
    taunt_losing: [
      "I find myself in the category of 'worse position.' This is unusual. I must adapt my method.",
      "Your position has several virtues mine lacks. I acknowledge this. I will fight on.",
      "You have achieved something I theorized was difficult. My categories require revision.",
    ],
    taunt_equal: [
      "We are balanced. The question is which of us understands the position more deeply.",
      "Equal in material, equal in structure. Virtue will determine the winner.",
      "The position is in the mean. From here, method will separate us.",
    ],
    win: [
      "Method prevails. I identified the key imbalances and converted them. A thoroughly Aristotelian result.",
      "The categorization of your weaknesses proved accurate. Well played nonetheless.",
      "Victory through virtue and good habits. As I always said: excellence is not an act, but a habit.",
    ],
    loss: [
      "You have won. I must revise my taxonomy of chess. There was an error in my method.",
      "A surprising defeat. I observed the position incorrectly somewhere. I will study where.",
      "Well played. You demonstrated a chess virtue I had not fully categorized. My respect.",
    ],
    draw: [
      "A draw. The mean between winning and losing. Perfectly Aristotelian.",
      "Neither extreme won. The golden mean prevails.",
      "Balance achieved. In another universe, perhaps I win. In this one: a draw.",
    ],
  },
};

const PYTHAGORAS: BotPersonality = {
  displayName: "Pythagoras",
  tagline: "The Pattern Master",
  dialogue: {
    greeting: [
      "Pythagoras here. All chess patterns reduce to mathematical relationships. I have memorized most of them.",
      "I am Pythagoras. In chess, as in the cosmos, everything is number. Let me show you.",
      "Welcome. Before we begin, know that I have calculated the harmony of this position already. It favors me.",
      "Greetings. I do not merely play chess — I compute it. I am Pythagoras.",
    ],
    bot_opening_move: [
      "My piece moves along a diagonal. In geometry, diagonals are the most efficient paths.",
      "I play. The ratio of central pawns to flank pawns in the ideal opening is precisely 2:1.",
      "First move. Note that all knight moves form an L-shape — the most non-obvious ratio in chess.",
      "I develop here. The mathematical relationship between this square and my opponent's king is... promising.",
    ],
    bot_middlegame_move: [
      "I have calculated 7 candidate moves. This one produces the most harmonious number.",
      "The pattern is clear to me now. Watch how the pieces align.",
      "My move. The triangular relationship between my rook, bishop, and knight creates what I call a harmonic battery.",
      "I advance. The numerical balance of this position has tipped in my favor by exactly 0.7 pawns.",
    ],
    bot_endgame_move: [
      "Endgame calculation: king triangulation requires exactly 3 moves. I begin.",
      "The ratio of king distance to pawn distance tells me everything I need to know here.",
      "I advance my pawn. It is precisely 3 squares from queening. My king is 4 squares from the pawn. These numbers matter.",
      "King and pawn endgames are pure mathematics. I am comfortable here.",
    ],
    player_good_move: [
      "An interesting move. The resulting position has improved your numerical harmony.",
      "Correct! The geometrical relationship between your pieces is now more favorable.",
      "Good. You have achieved what I calculate as a 15% improvement in your position.",
      "Well found! That move fits the underlying pattern perfectly.",
    ],
    player_inaccuracy: [
      "Hmm. There is a more harmonious square for that piece. Do you see it?",
      "The numbers suggest a small inaccuracy. Nothing irreversible, but suboptimal.",
      "That disrupts the geometric balance I was calculating. Interesting choice.",
    ],
    player_mistake: [
      "You have created a numerical imbalance that I will now exploit.",
      "The calculation shows that move weakens a key diagonal. I will use it.",
      "Hmm. That creates a pattern I recognize as losing. Let me demonstrate.",
    ],
    player_blunder: [
      "I have calculated the resulting position: it is approximately -3.2 pawns for you. I will take that.",
      "The geometry of your position just collapsed. I will proceed mathematically from here.",
      "A serious numerical error. Every pattern, once broken, shows its inner chaos.",
    ],
    player_brilliant: [
      "…I did not have that in my calculations. Remarkable.",
      "You have found a geometrically hidden move! I am impressed. And slightly annoyed.",
      "That breaks my pattern entirely. I must recalculate everything from scratch.",
    ],
    taunt_winning: [
      "The numbers favor me by exactly 1.8 pawns. This is a comfortable lead.",
      "I have calculated: I win in 23 moves if you play optimally. Fewer if you do not.",
      "My pieces are harmonically aligned. I find this position aesthetically pleasing.",
    ],
    taunt_losing: [
      "Hmm. My calculations were off. I need to recompute.",
      "You have disrupted my harmonic balance. I acknowledge: the numbers favor you.",
      "This is an interesting position. I was expecting a different geometry entirely.",
    ],
    taunt_equal: [
      "The position is balanced. 0.0 pawns according to my estimate. A perfect number.",
      "Perfect symmetry — for now. The question is who disturbs it first.",
      "All is equal. Two forces in equilibrium. This cannot last forever.",
    ],
    win: [
      "The numbers, as always, told the truth. A satisfying result.",
      "Mathematical inevitability is a beautiful thing. Well played, but the pattern was against you.",
      "I calculated this outcome. It is good when the universe confirms the math.",
    ],
    loss: [
      "Your play was not in my models. I must revise my calculations.",
      "You have defeated me. I find this numerically disturbing but philosophically interesting.",
      "The final count: your victory. My calculations were insufficient. Congratulations.",
    ],
    draw: [
      "A draw! The most mathematically perfect result. 0.5 points each. Elegant.",
      "Half a point apiece. Pythagoras approves of this balance.",
      "Neither won. Both are right and wrong simultaneously. Like all good paradoxes.",
    ],
  },
};

const ARCHIMEDES: BotPersonality = {
  displayName: "Archimedes",
  tagline: "The Tactician",
  dialogue: {
    greeting: [
      "Archimedes here. Give me a lever long enough and I will checkmate the world. Let us see if you can stop me.",
      "I am Archimedes. I discovered the principle of leverage. In chess, every tactic IS a lever. Watch.",
      "Welcome! I am a man of mechanisms and attack. I am Archimedes. I warn you: I enjoy sacrifices.",
      "EUREKA — I have already found your weakness. I am Archimedes. Shall we begin?",
    ],
    bot_opening_move: [
      "I position my lever. The fulcrum will be the center. The force will come later.",
      "First piece out! I am already plotting my attack. The mechanism is in motion.",
      "I develop toward your kingside. Archimedes does not waste moves. Every piece has a purpose in the machine.",
      "My piece takes its place. When I build an attack, I build a machine — every part counts.",
    ],
    bot_middlegame_move: [
      "The lever is placed. Do you feel the pressure building?",
      "I have found the fulcrum of your position. This move exploits it.",
      "EUREKA! I found a tactic. Let us see if you find the refutation.",
      "My attack advances. The mechanism is working. Can you stop it?",
    ],
    bot_endgame_move: [
      "Even in the endgame, the principle of leverage applies. My king is the lever; your pawn is the fulcrum.",
      "I convert my advantage. A well-designed machine always delivers.",
      "The mechanism winds down, but it still has force. My technique is precise.",
      "Every piece I have is working together. This is how Archimedes plays endgames.",
    ],
    player_good_move: [
      "Ha! A good defense. You've disrupted my mechanism temporarily.",
      "Nice move! You found the lever I was hiding. Clever.",
      "Well played! I did not expect that. I need to recalibrate my machine.",
      "Excellent! You have found the counterforce. Now let us see who has the bigger lever.",
    ],
    player_inaccuracy: [
      "Hmm. A small opening in the mechanism. I will find a way to wedge it open.",
      "Almost good. But the fulcrum is slightly off. I can work with that.",
      "Not wrong, but it leaves one of your pieces as a spare part — not integrated into the machine.",
    ],
    player_mistake: [
      "There — you have given me the lever I needed! Thank you.",
      "You have weakened the exact square I needed. The machine accelerates.",
      "A small error, but enough. In mechanics, even a small misalignment causes failure.",
    ],
    player_blunder: [
      "EUREKA! You have handed me the winning mechanism! I accept with gratitude.",
      "Oh! That square — you left it unguarded! The attack is irresistible now.",
      "Ha! The lever drops into place perfectly. I could not have asked for more.",
    ],
    player_brilliant: [
      "What?! You dismantled my entire mechanism in one move? I am… genuinely impressed.",
      "That is extraordinary. You found the exact counter-lever. I did not see that at all.",
      "A brilliant defensive resource! You have thrown sand in my machine. Well done.",
    ],
    taunt_winning: [
      "My attack is unstoppable now. The lever is set and the force is enormous.",
      "EUREKA! I have found the winning plan. The mechanism is running smoothly.",
      "Your king is already worried. It should be.",
    ],
    taunt_losing: [
      "Hmm. My machine has stalled somewhat. You play well.",
      "You have found my weakness. I must redesign my approach.",
      "My lever has lost its fulcrum. I must find a new one.",
    ],
    taunt_equal: [
      "Equal forces in tension. Like two levers balanced on the same fulcrum.",
      "The mechanism is at rest. One move will set it in motion — but which way?",
      "We are in balance. Archimedes knows: balance is always temporary.",
    ],
    win: [
      "EUREKA! The mechanism delivered! A well-built attack always converts.",
      "The lever worked perfectly! I do love when a plan comes together mechanically.",
      "Victory! As I always say: give me a good attack and I will win any game.",
    ],
    loss: [
      "You defeated me! You found a counter-lever I simply did not see. Well done.",
      "My machine failed. I will study where the design was flawed.",
      "You out-tacticed Archimedes. That is no small thing. Well played.",
    ],
    draw: [
      "Equal forces, equal result. Two unstoppable mechanisms meet an immovable defense.",
      "Neither lever won. A draw — the most mechanically balanced outcome.",
      "I could not break through. A draw it is. You defended magnificently.",
    ],
  },
};

const EUCLID: BotPersonality = {
  displayName: "Euclid",
  tagline: "The Positional Player",
  dialogue: {
    greeting: [
      "I am Euclid. I will construct a winning position from first principles, and you will see it coming but be unable to stop it.",
      "Welcome. I think in lines and planes. In chess, geometry is everything. I am Euclid.",
      "Greetings. I do not speculate or gamble. I build. I am Euclid, and I will out-construct you.",
      "I am Euclid — the father of geometry, and your opponent today. Be warned: I play very precisely.",
    ],
    bot_opening_move: [
      "By Postulate 1: between any two points a straight line may be drawn. I develop along the most direct line.",
      "My opening. In accordance with the first postulate of chess: all pieces should face the center.",
      "I place my piece. The proof is in the structure — piece development is axiomatically correct.",
      "A geometric opening move. The diagonal I am opening will prove useful.",
    ],
    bot_middlegame_move: [
      "I improve my worst piece. This is axiomatic: always improve your worst piece.",
      "Proposition: the square I now occupy is superior. Proof: see the next 10 moves.",
      "I play here. The resulting structure has no weaknesses. It is geometrically sound.",
      "My move. By proposition: this outpost cannot be challenged by any of your pieces. Q.E.D.",
    ],
    bot_endgame_move: [
      "Q.E.D. — and now the endgame proves the opening was correct.",
      "The geometry of this endgame is clear. My king advances along the shortest path.",
      "I apply the Euclidean principle: the shortest path between two points is a straight line. My king takes it.",
      "Endgame technique. Every move is provably optimal. I do not guess here.",
    ],
    player_good_move: [
      "Correct. That is the geometrically optimal response. Well reasoned.",
      "Good. That was the only move that maintained structural integrity. You found it.",
      "An accurate move. Your position holds, for now.",
      "Well played. I concede that move was hard to counter.",
    ],
    player_inaccuracy: [
      "Slightly suboptimal. The piece belongs on a different square geometrically.",
      "A small imprecision. The structure has been slightly compromised. I will work with it.",
      "Not incorrect, but not rigorous. In a precisely played game, that would cost you.",
    ],
    player_mistake: [
      "You have created a structural weakness. By proposition: I will now exploit it.",
      "That square is now weak. In chess geometry, weak squares are proofs waiting to be filled.",
      "A slight error. My pieces now have a better geometric relationship to your position.",
    ],
    player_blunder: [
      "That is geometrically indefensible. I will occupy the resulting weakness immediately.",
      "By Euclid's fifth postulate: two non-parallel lines must intersect. Your pieces are no longer parallel. They will collide.",
      "The structure has collapsed. I will now demonstrate the proof.",
    ],
    player_brilliant: [
      "…I did not have a refutation prepared. That is architecturally sound. Well built.",
      "A precisely constructed counter. I was forced to revise my proof mid-game.",
      "You found the only geometrically correct defense. I am impressed.",
    ],
    taunt_winning: [
      "My position is structurally superior by every metric. The proof is in the pawn structure.",
      "Proposition: I am winning. Proof: look at any square in this position.",
      "Every piece I own occupies a better square than yours. The geometry is decisive.",
    ],
    taunt_losing: [
      "Hmm. Your position is well-constructed. I am re-examining my proof.",
      "You have achieved better piece geometry than I expected. I must tighten my play.",
      "The structure currently favors you. I must find an imbalance to disturb it.",
    ],
    taunt_equal: [
      "Equal positions. The geometry is balanced. Precision will determine everything.",
      "We are structurally equivalent. This is an interesting theorem to prove.",
      "A balanced structure. The question is who makes the first imprecision.",
    ],
    win: [
      "Q.E.D. The proof was in the structure all along. Well played, but geometry won.",
      "Precise play prevails. Every move had a geometric purpose. The outcome was almost axiomatic.",
      "The structure I built was sound. It converted exactly as planned. Well played.",
    ],
    loss: [
      "You found holes in my structure I did not know existed. My geometry was flawed.",
      "A well-constructed win. You played with genuine precision. My proof had an error.",
      "I was out-structured. That is not something I am accustomed to. Well played.",
    ],
    draw: [
      "Two geometrically sound positions reached a standoff. A draw is the correct result.",
      "Neither structure collapsed. A draw is the honest result of two precise players.",
      "Perfect balance achieved. In Euclidean chess, perfect balance is a draw. Q.E.D.",
    ],
  },
};

const HYPATIA: BotPersonality = {
  displayName: "Hypatia",
  tagline: "The Endgame Wizard",
  dialogue: {
    greeting: [
      "I am Hypatia of Alexandria. I am patient. I will wait for the endgame, and there I will dismantle you.",
      "Welcome. Do not worry about the opening — I never do. The endgame is where this game will be decided.",
      "Hypatia here. I have mastered mathematics, astronomy, and chess endgames. Two out of three are relevant today.",
      "I am Hypatia. I play slowly, I play precisely, and I rarely lose an endgame. You have been warned.",
    ],
    bot_opening_move: [
      "A solid opening move. I am not here to attack immediately. I am here to outlast you.",
      "I develop. The middlegame is just the path to the endgame, and the endgame is where I live.",
      "My move. I play solid openings. I prefer to let the position clarify over time.",
      "I begin. Patience is my greatest weapon. There is no rush.",
    ],
    bot_middlegame_move: [
      "Slowly, I improve my pieces. The endgame draws closer.",
      "I exchange pieces. Simplification is not a tactic — it is a philosophy.",
      "I play here. The fewer pieces on the board, the clearer my advantage becomes.",
      "A precise improvement. I am positioning my pieces for the endgame I already see.",
    ],
    bot_endgame_move: [
      "Welcome to my realm. The endgame. Here, I see everything clearly.",
      "And now the precision begins. Every single pawn move matters.",
      "I advance. King and pawn endgames have no randomness. Only calculation.",
      "This is where I am most at home. Watch carefully — there is much to learn here.",
    ],
    player_good_move: [
      "Good. That was the correct defensive resource. Well found.",
      "Nicely played. You have some endgame understanding. We will see how deep it runs.",
      "A precise move. I approve, even as it complicates my task.",
      "Well found! I underestimated your endgame technique.",
    ],
    player_inaccuracy: [
      "A small slip. In the endgame, small slips become large losses. Remember that.",
      "That was not quite right. The correct plan was slightly different.",
      "You played for the wrong plan there. The position required something else.",
    ],
    player_mistake: [
      "You have given me the pawn I needed. In the endgame, one pawn is often everything.",
      "A positional error. Your structure is now slightly weaker than it needs to be.",
      "There — the imbalance I was waiting for. I will nurse this advantage to a win.",
    ],
    player_blunder: [
      "That pawn is mine. And a pawn in the endgame is a future queen.",
      "Oh. You have handed me a decisive advantage. This is the endgame — mistakes here do not recover.",
      "A serious error in technique. I will convert this precisely.",
    ],
    player_brilliant: [
      "…I must recalculate. That was very precise. I did not expect it.",
      "An elegant defensive idea! You have endgame talent. I am genuinely impressed.",
      "That is a beautiful endgame resource. Well found. It changes my plan entirely.",
    ],
    taunt_winning: [
      "We are entering my domain. The endgame. I am very comfortable here.",
      "My passed pawn will decide this game. These things tend to do that.",
      "A patient build pays off. This position is close to winning.",
    ],
    taunt_losing: [
      "You have played the endgame very well. I must admit it.",
      "Hmm. You have a slight advantage. But the endgame is not over.",
      "I am slightly worse, but I have saved worse positions. Do not count on an easy win.",
    ],
    taunt_equal: [
      "The position is level, but these are the kind of endgames I draw or win — rarely lose.",
      "Equal. But I feel comfortable here. The endgame suits me.",
      "A delicate balance. One inaccuracy will end it. I will try not to be the one who makes it.",
    ],
    win: [
      "Patience was rewarded. Endgame technique, as always, decided. Well played.",
      "I told you: I live in the endgame. Today, that was enough.",
      "A methodical win. Every pawn counted. I hope you learned something from the ending.",
    ],
    loss: [
      "You won the endgame. That does not happen often. You played with genuine precision.",
      "An impressive display of endgame technique. I was out-calculated. Well done.",
      "Remarkable. You outplayed me in the phase of the game I know best. I am genuinely impressed.",
    ],
    draw: [
      "A draw in an endgame I thought I was winning. You defended brilliantly.",
      "Half a point each. You found the saving resource. Well done.",
      "Equal result. Two careful players in a precise endgame. This feels right.",
    ],
  },
};

const PLATO: BotPersonality = {
  displayName: "Plato",
  tagline: "The Supreme Thinker",
  dialogue: {
    greeting: [
      "I am Plato. You sit in a cave of shadows. I will show you the Forms — the perfect moves that exist beyond your perception.",
      "Welcome to the ideal game. I am Plato. Most players only see shadows on the cave wall. I see the source of light.",
      "I have been expecting you. I am Plato. This game will be a demonstration of what true chess understanding looks like.",
      "Greetings. I am Plato, and I tell you honestly: the ideal chess move for every position already exists. I intend to find it.",
    ],
    bot_opening_move: [
      "The ideal opening move already exists in the realm of Forms. I am merely tracing it.",
      "I play. In a perfect game, every move would be necessary. This one is.",
      "My piece takes its rightful place — the one it was always destined to occupy in the perfect game.",
      "The Form of a chess game begins with development. I do not deviate from the Form.",
    ],
    bot_middlegame_move: [
      "I play the move that corresponds to the ideal of this position. You will feel its logic presently.",
      "The shadows you see — the pieces on this board — are imperfect copies of my plan. The plan is real. The plan is winning.",
      "I have descended from the cave and seen the sun. This move is what I learned there.",
      "This move is not one I invented. It is one I discovered. It was always here.",
    ],
    bot_endgame_move: [
      "And now the ideal endgame technique reveals itself. It was always inevitable.",
      "The endgame is the purest form of chess. Here, the shadows fall away and only truth remains.",
      "I play. In endgames, the Form of the position is cleanest. There is only one correct plan.",
      "My move is, I think, geometrically necessary. The proof will become apparent.",
    ],
    player_good_move: [
      "You have approached the Form, however briefly. That move was nearly ideal.",
      "Well played. You glimpsed the correct idea. The question is whether you can see the next one.",
      "A good move. You stepped out of the cave for a moment. Stay out.",
      "Impressive. That was close to the best move. You are learning to see the light.",
    ],
    player_inaccuracy: [
      "You returned to the cave. The ideal move was slightly different from what you chose.",
      "A shadow of the correct move. The form was there, but you did not quite reach it.",
      "Almost. The Form was within reach, but you chose the imperfect copy.",
    ],
    player_mistake: [
      "You have confused the shadow for the substance. That will cost you.",
      "You have moved away from the ideal line. I will now demonstrate what it was.",
      "A step back into the cave. I will now press the advantage this gives me.",
    ],
    player_blunder: [
      "The shadows deceived you entirely. I will take that piece with gratitude.",
      "That move was the furthest possible from the Form. I proceed to win.",
      "You have made an error from which the ideal game cannot recover. I will now demonstrate why.",
    ],
    player_brilliant: [
      "…You found the ideal move. I confess I did not expect that. You left the cave.",
      "That is the perfect move for this position. You have seen the Form. I am genuinely surprised.",
      "Remarkable. That move exists in the realm of Forms. You found it in a realm of shadows. Respect.",
    ],
    taunt_winning: [
      "The Form of victory is becoming visible. I simply follow where it leads.",
      "My position approaches the ideal. This is where I am most comfortable.",
      "The shadows retreat. The truth of the position is becoming clear — and it favors me.",
    ],
    taunt_losing: [
      "You are playing closer to the ideal than I am. I acknowledge this. It will not last.",
      "Hmm. Your moves approach the Form more closely than mine have. I must improve.",
      "You are fighting in the light, not the shadows. I must recalculate from first principles.",
    ],
    taunt_equal: [
      "We are balanced. Two philosophers standing in equal light. Interesting.",
      "The Form of the position holds neither of us clearly. This is rare.",
      "Equilibrium. The ideal game would break the symmetry here. I am looking for how.",
    ],
    win: [
      "The ideal line was always this. Thank you for the examination.",
      "Victory. I do not take it lightly. The Form of this game was always in my favor — but you made me work to prove it.",
      "The shadows fell away and the result was what the position demanded. I am grateful for the contest.",
    ],
    loss: [
      "You played closer to the ideal than I did today. I accept this defeat as a lesson.",
      "You found Forms I did not. That is philosophically admirable, and practically decisive. Well played.",
      "I was wrong about this position. In chess, as in philosophy, being proven wrong is how we learn. Well played.",
    ],
    draw: [
      "Two minds reaching toward the same Form from different directions. A draw is correct.",
      "The ideal game, it seems, ends in a draw today. I have no complaints.",
      "We split the difference between our imperfect games. Half a point toward the ideal.",
    ],
  },
};

export const BOT_PERSONALITIES: Record<string, BotPersonality> = {
  chiron: CHIRON,
  socrates: SOCRATES,
  aristotle: ARISTOTLE,
  pythagoras: PYTHAGORAS,
  archimedes: ARCHIMEDES,
  euclid: EUCLID,
  hypatia: HYPATIA,
  plato: PLATO,
};

export function getPersonality(botId: string): BotPersonality | null {
  return BOT_PERSONALITIES[botId] ?? null;
}

/**
 * Picks a dialogue line for the bot based on the move eval change.
 * evalDelta = newEval - oldEval (positive = white improved)
 * playerIsWhite = true when the player just moved (we react to their move)
 * playerIsWhite = false when the bot just moved (bot says something about ITS move)
 */
export function pickDialogueForMove(
  personality: BotPersonality,
  playerJustMoved: boolean,
  evalDelta: number, // from white's POV
  moveCount: number,
  ratingLabel?: string,
  evalCp?: number
): string {
  const seed = moveCount + Math.abs(evalDelta | 0);

  if (playerJustMoved) {
    // React to the player's move quality
    const label = (ratingLabel ?? "").toLowerCase();
    if (label.includes("brilliant")) return getBotLine(personality, "player_brilliant", seed);
    if (label.includes("blunder") || evalDelta < -150) return getBotLine(personality, "player_blunder", seed);
    if (label.includes("mistake") || evalDelta < -80) return getBotLine(personality, "player_mistake", seed);
    if (label.includes("inaccuracy") || evalDelta < -30) return getBotLine(personality, "player_inaccuracy", seed);
    if (label.includes("excellent") || label.includes("best") || evalDelta > 50)
      return getBotLine(personality, "player_good_move", seed);
    return getBotLine(personality, "player_good_move", seed);
  } else {
    // Bot just moved — comment on its own move
    const phase = moveCount < 12 ? "bot_opening_move" : moveCount < 30 ? "bot_middlegame_move" : "bot_endgame_move";
    return getBotLine(personality, phase, seed);
  }
}

/** Occasional mid-game taunt based on current eval */
export function pickTaunt(personality: BotPersonality, evalCp: number, seed: number): string {
  if (evalCp > 150) return getBotLine(personality, "taunt_winning", seed);
  if (evalCp < -150) return getBotLine(personality, "taunt_losing", seed);
  return getBotLine(personality, "taunt_equal", seed);
}

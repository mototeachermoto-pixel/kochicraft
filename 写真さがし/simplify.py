"""Special（feature）と About（about）の英文を、小学5年生で習う短い文に書きかえる。
古い文 → 新しい文。ファイルの中の「feature: '古い', about: '古い'」の組をそのまま置きかえる（どれも1回だけ）。
"""
import glob
import io
import re
import sys

ROOT = sys.argv[1]
# (古い Special, 古い About) -> (新しい Special, 新しい About)。Let's は ' をエスケープした形で書く
NEW = {
    ("They go straight down to the sea.", "They are very, very high. Wow!"): ("They are very high.", "Look down. Wow!"),
    ("It has glass. You can see down!", "Look far. The sea looks round!"): ("It is over the sea.", "The sea is big and round."),
    ("It is tall, white, and round.", "It is very big. Its light goes very far at night."): ("It is tall and white.", "It is bright at night."),
    ("It is far down there.", "The sea goes on and on."): ("It is big and blue.", "Look far away!"),
    ("It has a hole like a big door.", "The sea made this hole. Many, many years!"): ("It is like a big door.", "It is a rock in the sea."),
    ("He looks at the sea.", "He lived in America. He learned English and helped Japan."): ("He is John Manjiro.", "He is a hero of Kochi."),
    ("It is a small stone.", "Shikoku ends here. This is the south end!"): ("It is a stone.", "This is the south end of Shikoku."),
    ("Red flowers are over your head.", "About 60,000 flower trees are here!"): ("It has many red flowers.", "It is pretty in winter."),
    ("It is small, red, and round.", "Long ago, a young man bought a pretty present here. People sing about it!"): ("It is small and red.", "It is a famous bridge in Kochi."),
    ("It is green and white. It runs on the road.", "It is a small train. People ride it every day."): ("It is green and white.", "People ride it every day."),
    ("It has a big green sign.", "Long ago, Mr. Hirome lived here. That is the name!"): ("It has a big green sign.", "It has many shops."),
    ("They cook it on a fire for you.", "They cook fish on a big fire. Whoosh!"): ("They cook it on a fire.", "It is a fish shop."),
    ("The tables are long. The chairs are low.", "Buy food you like. Eat together here!"): ("The tables are long.", "Let\\'s eat together!"),
    ("The fish is cooked only on the outside.", "It is a famous food of Kochi. Yummy!"): ("It is fish.", "It is a famous food of Kochi."),
    ("Utsubo is a long fish. It looks like a snake!", "People in Kochi like it. It is crispy."): ("It is a long fish.", "It is crispy and good."),
    ("The shells open when they get hot.", "You can cook them at your table. It is fun!"): ("They are hot and good.", "Let\\'s cook at the table!"),
    ("It is blue and very big.", "The sea is strong here. Do not swim."): ("It is big and blue.", "Do not swim here."),
    ("It has small stones of five colors.", "The moon is very pretty here. People sing about it!"): ("It has colorful stones.", "The moon is pretty here."),
    ("It is on a rock by the sea.", "People come here and say thank you to the sea."): ("It is on a big rock.", "It is red and white."),
    ("They are green all year.", "Green trees and white sand are very pretty."): ("They are green.", "I like the green trees."),
    ("They are on the two sides of the beach.", "Their names are Dragon Head and Dragon King!"): ("They are big rocks.", "Their names are Dragon Head and Dragon King."),
    ("It is white and has gray roofs.", "It is very old. People in Kochi love it."): ("It is white.", "It is very old."),
    ("It is low and white.", "It is a big old house. The old tower and the old palace are both here. Only Kochi Castle has both!"): ("It is an old house.", "It is next to the castle."),
    ("The wall is high and strong.", "Kochi has a lot of rain. The water comes out here."): ("The wall is high.", "Water comes out of the pipes."),
    ("It is big. It is wood and stone.", "You can see the gate and the castle together. Nice photo!"): ("It is a big gate.", "Let\\'s take a photo!"),
    ("They are pink and pretty.", "In spring, people eat and have fun here."): ("They are pink.", "They are pretty in spring."),
    ("He stands up high.", "He is Itagaki Taisuke, a great man from Kochi."): ("He is Itagaki Taisuke.", "He is a great man of Kochi."),
    ("The man and the horse are very big.", "He is Yamauchi Kazutoyo. He made Kochi Castle long ago."): ("He is on a horse.", "He is Yamauchi Kazutoyo."),
    ("They are old stones.", "Let\\'s go up to the castle!"): ("They are old stones.", "Let\\'s go to the castle!"),
    ("It is big. It is all glass.", "It is warm in there, like a jungle!"): ("It is a glass house.", "It is warm inside."),
    ("There are trees, flowers, and bamboo.", "About 3,000 kinds of plants are here!"): ("There are many flowers.", "There are many trees, too."),
    ("The water is clean.", "Walk on the wood path. Go slowly and look!"): ("The water is clean.", "Let\\'s walk slowly."),
    ("It has a nice wood roof.", "Dr. Makino loved plants. He gave names to about 1,500 plants!"): ("It has a wood roof.", "This is Dr. Makino\\'s museum."),
    ("It is short and green.", "Sueko was his wife. This plant has her name."): ("It is small and green.", "Its name is Sueko Bamboo."),
    ("They are big and dark.", "Long ago, these rocks were under the sea!"): ("They are big and black.", "They are very old."),
    ("It is white. It is on a hill.", "Its light is very, very strong. It helps ships at night."): ("It is white.", "It is bright at night."),
    ("It goes far, far away.", "Big whales swim out there!"): ("It is big and blue.", "You can see whales!"),
    ("Its roots are like octopus legs.", "It is a big old tree. It is a treasure of Muroto."): ("Its roots are like octopus legs.", "It is very big and old."),
    ("It is dark and quiet.", "A young man lived here long ago. He saw only the sky and the sea."): ("It is dark.", "It is a famous cave."),
    ("They are tall. They have big leaves.", "Muroto is warm. So they are happy here!"): ("They are tall.", "Muroto is warm."),
    ("The steps go down to the water.", "Go down, down, down. The blue water is there!"): ("The steps go down.", "The blue water is there!"),
    ('It is very blue. We call this blue "Niyodo Blue."', "People say a big snake lives here. Be quiet, please."): ("It is very blue.", 'We call it "Niyodo Blue."'),
    ("It is white. It goes straight down.", "The water is very clean. So the pond is blue!"): ("It is white.", "The water is clean."),
    ("They are big and tall.", "It is cool and quiet here."): ("They are big.", "It is cool and quiet."),
    ("It has a very big mouth.", "It does not move. It stands and stands!"): ("It has a big mouth.", "It does not move."),
    ("They live in one big place.", "They live together, like in Africa!"): ("They live together.", "It is like Africa!"),
    ("It goes up the wood tower.", "It is very smart. It can do many things!"): ("It likes the tower.", "It is very smart."),
    ("They are big and round.", "They love water. They eat grass!"): ("They are big and round.", "They like water."),
    ("Its long tail is black and white.", "It walks with its tail up. Cute!"): ("It has a long tail.", "Its tail is black and white."),
    ("It is red and brown. It has a long tail.", "It likes cool places. It sleeps in trees."): ("It is red and brown.", "It sleeps in trees."),
    ("He is very, very tall.", "Young people of Kochi made it about 100 years ago."): ("He is very tall.", "He is Sakamoto Ryoma."),
    ("His face is right there!", "In spring and fall, you can go up and see his face!"): ("His face is there!", "You can go up in spring and fall."),
    ("It is big and blue.", "The sea is behind Ryoma. He had a big dream!"): ("It is big and blue.", "Ryoma looks at the sea."),
    ("It is a stone with words.", "Let\\'s read the words on it!"): ("It has words on it.", "Let\\'s read it!"),
    ("Some go down. Some go up.", "Drip, drip... They grow very, very slowly."): ("Some go down. Some go up.", "They grow very slowly."),
    ("It is in the rock.", "People made this pot long, long ago. People lived here!"): ("It is in the rock.", "It is very, very old."),
    ("It is the second biggest waterfall in this cave.", "After a big rain, the water is very strong!"): ("It is a big waterfall.", "The water is strong after rain."),
    ("It is a famous big cave in Japan.", "Water made this cave. It is very, very old!"): ("It is a big cave.", "It is very old."),
    ("The water is very clean.", 'It is a famous clean river. People call it "the last clear river."'): ("The water is clean.", "It is a famous river."),
    ("It is low and flat.", "It rains a lot. Then the water goes over the bridge. But the bridge is OK!"): ("It is low and flat.", "Water goes over it on rainy days."),
    ("They are small and colorful.", "Canoes are fun! Splash, splash!"): ("They are colorful.", "Canoes are fun!"),
    ("It is long and slow.", "People ride this boat and enjoy the river."): ("It has a roof.", "It is slow."),
    ("They are round and green.", "The green hills are by the river. The air is good!"): ("They are green.", "The air is good!"),
}

PAT = re.compile(r"(feature: )'(.*?)',(\n\s*about: )'(.*?)',")
done = set()
for p in sorted(glob.glob(ROOT + '/src/spots/*.ts')):
    s = io.open(p, encoding='utf-8').read()

    def rep(m):
        key = (m.group(2), m.group(4))
        if key not in NEW:
            return m.group(0)
        if key in done:
            raise SystemExit(f'2回目: {key}')
        done.add(key)
        nf, na = NEW[key]
        return f"{m.group(1)}'{nf}',{m.group(3)}'{na}',"

    s2 = PAT.sub(rep, s)
    if s2 != s:
        io.open(p, 'w', encoding='utf-8', newline='').write(s2)
missing = [k for k in NEW if k not in done]
print('changed', len(done), 'of', len(NEW))
for k in missing:
    print('NOT FOUND:', k)

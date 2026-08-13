const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\473a9516-afb6-4330-a003-78928b2cf523';
const destUser = 'c:\\Users\\USER\\Documents\\GitHub\\PROYECTO X-USER\\public';
const destAdmin = 'c:\\Users\\USER\\Documents\\GitHub\\PROYECTO X-ADMIN\\public';

const filesToCopy = [
    { src: 'media__1772637305500.jpg', destList: [{ dir: destUser, name: 'brand-1.jpg' }, { dir: destAdmin, name: 'brand-1.jpg' }] },
    { src: 'media__1772637305598.jpg', destList: [{ dir: destUser, name: 'brand-2.jpg' }, { dir: destAdmin, name: 'brand-2.jpg' }] },
    { src: 'media__1772637305626.jpg', destList: [{ dir: destUser, name: 'brand-3.jpg' }, { dir: destAdmin, name: 'brand-3.jpg' }] },
];

filesToCopy.forEach(file => {
    const srcPath = path.join(srcDir, file.src);
    file.destList.forEach(dest => {
        const destPath = path.join(dest.dir, dest.name);
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${srcPath} to ${destPath}`);
    });
});
